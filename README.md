# @alexcatdad/browser-ocr

Browser-local OCR, image and PDF primitives, independent of Romanian identity-card rules and React. Version 0.1.1 is available as a local archive; it is not published on npm.

```sh
npm install /absolute/path/to/alexcatdad-browser-ocr-0.1.1.tgz
npx browser-ocr-assets --to public/reader-assets
```

```ts
import { LocalOcrReader, PSM, clearCanvas } from '@alexcatdad/browser-ocr';

const reader = new LocalOcrReader(() => {}, {
  assetBaseUrl: '/reader-assets/',
  languages: 'eng+ron',
  pageSegmentation: PSM.AUTO,
});
await reader.prepare();
try {
  const result = await reader.read(canvas);
  // Consume raw text/confidence/lines locally; do not log personal data.
} finally {
  clearCanvas(canvas);
  await reader.dispose();
}
```

Prepare before accepting document input. Asset URLs must use the application's own HTTP(S) origin. The CLI copies self-hosted engine/model/PDF resources and licenses without downloading them; re-run it after upgrading. Identical files are skipped, conflicting files require `--force`, and unrelated files are retained.

`LocalOcrReader` supports local model names, page segmentation, character whitelists, initialization parameters and recognition parameters. It retains its worker after successful reads for sequential reuse; concurrent reads reject. Canvases are borrowed, raw output belongs to the caller, and the worker may retain buffers until disposal. Clear canvases and retained output yourself; call `dispose()` or `cancel()` when done. Recognition confidence is an engine estimate, not validation.

Exports also include `LocalPdfReader`, `decodeImage`, `prepareTextCanvas`, `clearCanvas`, types and `PSM`. PDF handling requires preparation before file selection and explicit caller-selected page rendering. The caller owns returned canvases. Node imports are safe; processing needs browser canvas/worker APIs. Safari/iOS 18+ is the target; physical Safari/camera and real-photo accuracy still require acceptance testing.

The package makes no document-data network calls and does not persist input/output. Public software assets load during preparation. Host scripts, telemetry, callbacks and persistence remain the consuming application's responsibility. Cleanup is not forensic memory erasure.

Develop this repository independently with `npm ci`, `npm test` and `npm run build`; run `npm run verify` for unit, types and packed browser-consumer verification. See [RUNBOOK.md](RUNBOOK.md) for setup, asset maintenance and distribution. `prepare` builds Git installations, so an application can pin `git+https://github.com/alexcatdad/browser-ocr.git#<full-commit-sha>`.

The independently versioned `@alexcatdad/roid` package in [romanian-id-prefill](https://github.com/alexcatdad/romanian-id-prefill) depends on this one. OCR has no ROID or React dependency. OCR source history was preserved when extracting the former `packages/ocr` subtree.

[Full integration guide](https://github.com/alexcatdad/romanian-id-prefill/blob/main/docs/LIBRARY.md). License: `UNLICENSED`; include packaged third-party notices and asset licenses. No registry publication or public reuse license is implied.
