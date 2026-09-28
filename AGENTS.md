# Project instructions

Read README.md, RUNBOOK.md and decisions.jsonl before changes. Record important decisions and update the runbook for multi-command workflows.

This is generic browser-local OCR/image/PDF infrastructure. Do not add Romanian identity rules, React, remote OCR, upload endpoints, telemetry or persistent document storage. Host engine/models/workers locally and preserve worker network guards and cleanup behavior. Never commit real IDs, personal OCR output or identifying screenshots; use synthetic fixtures.

Keep dependencies exact, package imports safe in Node, and processing APIs browser-only. Run npm run verify before handoff. Safari/iOS 18+ is the target; WebKit automation is not physical Safari certification. Source/CI changes are authorized; npm publication and website deployment need separate authorization. Parallel agents are allowed for disjoint tasks and should finish when done.
