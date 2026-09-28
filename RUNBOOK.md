# Browser OCR runbook

## Develop and verify

Use Node 24 (minimum 22.13). From this repository root:

```sh
npm ci
npx playwright install chromium webkit
npm run verify
```

`npm ci` runs `prepare` to generate the package library and self-hosted runtime assets. `npm test` runs unit tests; `npm run typecheck` checks source types; `npm run build` builds ESM and declarations and verifies/copies pinned local assets. `npm run test:package` builds then installs a packed archive into an independent temporary project and checks browser OCR/PDF behavior. `verify` runs all these checks. Browser fixtures must be synthetic and must not record document data.

## Package delivery and consuming apps

```sh
npm pack
# In the consuming application:
npm install /absolute/path/to/alexcatdad-browser-ocr-0.1.1.tgz
npx browser-ocr-assets --to public/reader-assets
```

Alternatively install a reviewed immutable Git commit through `git+https://github.com/alexcatdad/browser-ocr.git#<full-sha>`; npm runs `prepare` and installs development tools to build the Git dependency. Archive consumers receive built artifacts and do not need those build tools. Copy assets again after an upgrade. Identical assets are skipped; conflicting assets need explicit `--force`; unrelated host files remain intact.

## Changes and release

Read README, AGENTS and decisions first. Keep important decisions in decisions.jsonl. Change models only with recorded provenance, license and SHA256 in assets manifests, then run the full verification. Asset generation never downloads models. Keep OCR independent of Romanian ID or React logic. Maintain API compatibility or record a versioned change; downstream ROID should pin the reviewed commit or archive.

Push source changes only after local verification, then inspect CI for that exact commit. CI never publishes a package or deploys a website. Registry publication requires separate user authorization. This repository was extracted with subtree history from romanian-id-prefill/packages/ocr; future OCR development belongs here.
