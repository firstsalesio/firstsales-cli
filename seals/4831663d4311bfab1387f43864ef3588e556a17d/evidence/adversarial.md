# Phase 9 Adversarial bug hunt

Concurrency: command is a single GET; no shared state. Boundary: id with slashes, spaces or unicode goes through the shared path encoder; empty id is refused as missing_required_flag before any request (tested for the missing flag case). State corruption: none, read-only, no files written. Error path: 400, 401, 404 from the backend pass through the existing error renderer (same path as every other workspace command, covered by sibling tests). Contract: placeholder, flag, allow-list, required list, README, contract JSON and parity fixture all use `campaignEmail`; the previous mismatch bug was found and fixed, and the new test would fail if it came back.
Mutation smoke: renaming the placeholder in src/commands.js makes tests/campaign-email-state.test.js fail (the request path would not contain the id).
Confirmed bugs: none.
