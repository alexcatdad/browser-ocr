import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, cp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium, webkit, expect } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'browser-ocr-consumer-'));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
let server;
async function run(command, args, cwd = temp) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
try {
  // Packing, installing and resolving happen outside this checkout. No aliases,
  // source imports, workspace links or unpublished node_modules are available.
  await run('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', temp], root);
  const archive = `./${metadata.name.replace('@', '').replace('/', '-')}-${metadata.version}.tgz`;
  await access(join(temp, archive));
  await writeFile(join(temp, 'package.json'), JSON.stringify({ name: 'installed-ocr-consumer', private: true, type: 'module' }));
  await run('npm', ['install', '--ignore-scripts', '--omit=peer', '--no-audit', '--no-fund', archive]);
  const ocrInstalled = join(temp, 'node_modules/@alexcatdad/browser-ocr');
  await assert.rejects(access(join(ocrInstalled, 'src')), 'OCR package must not require source files');
  for (const dependency of ['react', 'mrz', '@alexcatdad/roid']) {
    await assert.rejects(access(join(temp, 'node_modules', dependency)), `Generic OCR must not depend on ${dependency}`);
  }
  await run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { LocalOcrReader, LocalPdfReader } from '@alexcatdad/browser-ocr';
    assert.equal(typeof window, 'undefined');
    assert.equal(typeof LocalOcrReader, 'function');
    assert.equal(typeof LocalPdfReader, 'function');
  `]);
  const versions = { ...metadata.dependencies, ...metadata.devDependencies };
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...['typescript', 'vite'].map((name) => `${name}@${versions[name]}`)]);
  await cp(join(root, 'tests/package'), temp, { recursive: true });
  await run(join(temp, 'node_modules/.bin/browser-ocr-assets'), ['--to', 'public/reader-assets']);
  const assets = join(temp, 'public/reader-assets');
  await run(join(temp, 'node_modules/.bin/browser-ocr-assets'), ['--to', 'public/reader-assets']);
  await writeFile(join(assets, 'host-owned.txt'), 'Preserve unrelated host assets');
  await writeFile(join(assets, 'ocr/model.json'), 'conflicting asset');
  await assert.rejects(run(join(temp, 'node_modules/.bin/browser-ocr-assets'), ['--to', 'public/reader-assets']), 'CLI must refuse differing destination assets');
  assert.equal(await readFile(join(assets, 'ocr/model.json'), 'utf8'), 'conflicting asset');
  await run(join(temp, 'node_modules/.bin/browser-ocr-assets'), ['--to', 'public/reader-assets', '--force']);
  assert.equal(await readFile(join(assets, 'host-owned.txt'), 'utf8'), 'Preserve unrelated host assets');
  for (const path of ['ocr/local-worker.js', 'ocr/worker.min.js', 'ocr/mrz.traineddata.gz', 'ocr/eng.traineddata.gz', 'ocr/ron.traineddata.gz', 'pdf/local-worker.mjs', 'pdf/pdf.worker.mjs', 'pdf/resources.json']) await access(join(assets, path));
  const assetManifest = JSON.parse(await readFile(join(ocrInstalled, 'runtime-assets/manifest.json'), 'utf8'));
  for (const entry of assetManifest.files) {
    const bytes = await readFile(join(assets, entry.path));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  const manifest = JSON.parse(await readFile(join(assets, 'ocr/model.json'), 'utf8'));
  assert.equal(createHash('sha256').update(await readFile(join(assets, 'ocr/mrz.traineddata.gz'))).digest('hex'), manifest.sha256);
  const printedModels = JSON.parse(await readFile(join(assets, 'ocr/printed-models.json'), 'utf8'));
  for (const model of printedModels.models) assert.equal(createHash('sha256').update(await readFile(join(assets, `ocr/${model.language}.traineddata.gz`))).digest('hex'), model.sha256);
  await run(join(temp, 'node_modules/.bin/tsc'), ['--pretty', 'false']);
  await run(join(temp, 'node_modules/.bin/vite'), ['build']);
  server = spawn(join(temp, 'node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', '4191', '--strictPort'], { cwd: temp, stdio: 'inherit' });
  const origin = 'http://127.0.0.1:4191';
  for (let attempt = 0; ; attempt++) {
    try { const response = await fetch(origin); if (response.ok) break; if (attempt === 100) console.error('Preview response:', response.status, await response.text()); } catch (error) { if (attempt === 100) console.error(error); }
    if (attempt >= 100) throw new Error('Consumer preview failed to start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const [name, browserType] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await browserType.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      const startup = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => startup.push(request.url()));
      await page.goto(origin);
      await expect(page.locator('#status')).toHaveText('Consumer ready');
      await page.evaluate(() => window.ocrConsumer.prepare());
      assert(startup.filter((url) => /^https?:/.test(url)).every((url) => new URL(url).origin === origin), 'All runtime assets must be same-origin');
      assert(startup.some((url) => url.includes('/reader-assets/ocr/')), 'OCR must use configured nested asset directory');
      const processing = [];
      const collect = (request) => { if (/^https?:/.test(request.url())) processing.push(request.url()); };
      page.on('request', collect);
      await context.setOffline(true);
      const generic = await page.evaluate(() => window.ocrConsumer.read());
      assert.match(generic.first.text, /Independent optical reader/i);
      assert.match(generic.second.text, /Independent optical reader/i);
      assert(generic.first.confidence > 50);
      assert.equal(generic.borrowed, true);
      assert.equal(generic.cleared, true);
      assert.equal(generic.ready, false);
      assert.deepEqual(processing, [], 'Repeated OCR must remain offline during reads');
      page.off('request', collect);
      await context.setOffline(false);
      await page.evaluate(() => window.ocrConsumer.prepare());
      processing.length = 0;
      page.on('request', collect);
      await context.setOffline(true);
      assert.deepEqual(await page.evaluate(() => window.ocrConsumer.cancelRead()), { rejected: true, ready: false, cleared: true });
      assert.deepEqual(processing, [], 'Cancellation must remain offline');
      page.off('request', collect);
      await context.setOffline(false);
      await page.evaluate(() => window.ocrConsumer.preparePdfReader());
      const pdfRequests = [];
      page.on('request', (request) => { if (/^https?:/.test(request.url())) pdfRequests.push(request.url()); });
      assert.equal(await page.evaluate(() => window.ocrConsumer.openPdf()), 1);
      await context.setOffline(true);
      const pdf = await page.evaluate(() => window.ocrConsumer.renderPdf());
      assert(pdf.width > 0 && pdf.height > 0);
      assert.deepEqual(pdf.black, [0, 0, 0, 255]);
      assert.deepEqual(pdfRequests, []);
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: await indexedDB.databases(), caches: await caches.keys() })), { local: 0, session: 0, databases: [], caches: [] });
      console.log(`${name}: standalone OCR, repeat reads, cancellation, cleanup, PDF rendering and offline privacy passed.`);
    } finally { await browser.close(); }
  }
  console.log('Standalone OCR archive passed independent Node import, strict TypeScript/build, asset integrity and browser integration.');
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  await rm(temp, { recursive: true, force: true });
}
