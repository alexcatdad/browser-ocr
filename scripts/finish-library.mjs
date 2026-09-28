import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(packageRoot, 'lib');
const runtime = join(packageRoot, 'runtime-assets');
async function walk(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(path)); else if (item.isFile()) result.push(path);
  }
  return result;
}
// Explicit .js specifiers make declarations usable with NodeNext as well as Bundler resolution.
for (const path of await walk(lib)) if (path.endsWith('.d.ts')) {
  const source = await readFile(path, 'utf8');
  await writeFile(path, source.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (_, before, specifier, after) => before + (/\.(?:js|json|css)$/.test(specifier) ? specifier : `${specifier}.js`) + after));
}
const files = [];
for (const path of await walk(runtime)) {
  const data = await readFile(path);
  files.push({ path: relative(runtime, path).split('\\').join('/'), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
files.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(join(runtime, 'manifest.json'), JSON.stringify({ version: JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')).version, files }, null, 2) + '\n');
console.log(`Prepared OCR package and ${files.length} verified self-hosted assets.`);
