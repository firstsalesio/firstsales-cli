# Phase 6 Zero tech debt

## Intended end state
`firstsales campaigns email-state --campaign-email <id>` is a first-class command in package 0.1.18, listed in help, README and CHANGELOG, with the publish contract and parity fixture matching.

## Real caller search
Searched src/ and tests/ for the placeholder `campaignEmail`, the flag `campaign-email` and the command name. Callers: src/commands.js registration, src/args.js allow-list and help, tests/campaign-email-state.test.js, the contract generator output and parity fixture. No unused surface added.

## Compatibility decision
No compatibility shim added and none retained. Nothing deleted because nothing is superseded; the command is new. Version bump is the only change to existing surface.

## Shared-rule ownership
Path building, required-flag checks, auth and output rendering stay in the existing shared workspace() helper and args.js. The command reuses them; no new rule was added. The version number lives in package.json and is mirrored by generated files checked by tests.

## Resulting product shape
One new read-only command, one flag, one regression test file, regenerated release artifacts. The repo-declared affected test command now also runs the new test file and uses TAP output so the gate can count tests.

## Verification
Ran the new tests (2 of 2), the affected command (18 of 18) and the full suite (1035 of 1035). Release contract check OK. oxlint 0 warnings and errors.
