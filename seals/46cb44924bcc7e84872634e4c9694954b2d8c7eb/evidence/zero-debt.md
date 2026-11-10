## Intended end state
CLI 0.1.19 exposes campaigns email-preview, and every copy of the contract (publish contract, parity fixture, release manifest copy) matches backend main.

## Real caller search
The command table in src/commands.js is the only registry. The help text in src/args.js lists the flag once. The new command is reached only through the CLI dispatcher.

## Compatibility decision
No compatibility shim added. Existing commands are unchanged. Nothing needs deleting.

## Shared-rule ownership
The generated publish contract and parity fixture come from repository scripts, not hand edits. The manifest copy is a byte copy of backend main. The workspace() builder and the campaignEmail flag are reused.

## Resulting product shape
One new read-only command beside email-state. No new abstraction, option or dependency.

## Verification
Tests run the real binary against a stub API and check method, path and auth header. The missing-flag test confirms no request is sent. release-contract:check is OK. The full suite passed 1040 of 1040 before the last commit.
