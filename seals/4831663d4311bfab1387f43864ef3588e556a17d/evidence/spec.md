# Phase 1 Spec compliance

Goal (issue 1624, CLI part): `firstsales campaigns email-state --campaign-email <id>` reads the derived lifecycle state of one campaign email from GET /campaign-emails/{campaignEmail}/state, with version 0.1.18 and the release contract updated.

- Present: command registered in src/commands.js with required campaignEmail; flag allow-listed in src/args.js and in help text.
- Present: regression tests in tests/campaign-email-state.test.js (path, auth, output, missing flag sends zero requests).
- Present: version 0.1.18 in package.json, lockfile, README badge, release-contract test; command counts 226; publish contract and openapi parity fixture regenerated.
- Present: CHANGELOG 0.1.18 entry and README command row.
- Extra: none. No unrelated files touched (12 files).
- Missing: none for the CLI. npm publish and GitHub release are owner steps, stated in the PR body.

Verdict: all requirements met.
