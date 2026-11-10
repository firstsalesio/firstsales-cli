# Spec check
Requirement: CLI 0.1.19 adds `campaigns email-preview --campaign-email <id>` calling GET campaign-emails/{id}/preview, with the contract, parity fixture and release manifest copy matching backend main (78edb3b35).
- Present: command in src/commands.js, help text in src/args.js, two tests, version bump in package.json, lockfile, README, CHANGELOG, regenerated publish contract, refreshed parity fixture and manifest copy.
- Missing: none. Extra: none.
