# Security evidence

HEAD: 4831663d4311bfab1387f43864ef3588e556a17d
Base: 66d4e70d3d48dd3a9d3be9b510b115966a0058a3

## Scanner receipts (written by security-scan.sh)

### Versions

- gitleaks: gitleaks version 8.30.1
- semgrep: 1.180.0
- osv-scanner: osv-scanner version: 2.7.0
- trivy: Version: 0.76.0

### Verdicts

```
  ✓ gitleaks (secrets): clean
  ✓ semgrep (SAST): clean
  · osv-scanner (deps): UNAVAILABLE/N/A — verified no declared package sources; no clean receipt
  ✓ trivy fs: clean
  ✓ offline trust: no new blocking findings; runtime/signing coverage still requires Phase 8 evidence
  · trivy: 0 new, 0 inherited from base (report-only)
```

## Judgment


Scope: the diff adds one read-only GET command (`campaigns email-state`) that sends the user's own API key as a Bearer header to the user-configured base URL, exactly like every other CLI command. It stores nothing, adds no dependency, no network host, no crypto and no TLS setting.

STRIDE: Spoofing, none (reuses the existing credential path). Tampering, none (GET, no body). Repudiation, none. Information disclosure: output is the email state only (id, status, lifecycle state, scheduled and sent time); the backend scopes the lookup to the workspace, so another tenant's id returns not found. Denial of service, none. Elevation of privilege, none (no new scope; the server decides access).
OWASP: A01 access control is enforced server side and unchanged here. A03 injection: the id is placed in the URL path through the shared path builder, which encodes it; no shell, no eval. A06 dependencies: none added (osv N/A, no declared package sources; lockfile only changes the package version). A08 integrity: release contract and manifest regenerated and checked by tests. A09 logging: the key is never printed (dry-run test asserts this for sibling commands; this command uses the same renderer).
Red-team: hostile id such as `../x` or `a/b` is encoded by the shared path builder, so the request stays under /campaign-emails/{id}/state. Missing flag sends zero requests (tested).

| # | control | status | applicability | paths | evidence | base attribution |
|---|---------|--------|---------------|-------|----------|------------------|
| 1 | runtime/trust inventory | PASS | no HTTP client or TLS change | package.json | offline inventory: runtime package.json only | none introduced |
| 2 | compromised keys/cross-signs | N/A | no certificates in diff | - | trust inspection: 0 certificates | none |
| 3 | actual-client rejection | N/A | no TLS/trust behavior changed | - | no change to client code | none |
| 4 | verification bypasses | PASS | none present in diff | src/*.js | semgrep clean, offline trust 0 findings | none introduced |
| 5 | key generation | N/A | none changed | - | diff has no key or token generation | none |
| 6 | validation regressions | N/A | no validation logic for TLS changed | - | not applicable | none |
| 7 | weak/reused keys | PASS | no keys in diff | - | gitleaks clean, 0 SPKI matches | none |
| 8 | signing chains | N/A | no signing or update verification changed | - | npm publish is a manual owner step | none |
| 9 | freshness/remediation | PASS | advisory snapshot reviewed 2026-10-21, expires 2026-11-21 | - | trust receipt coverage.advisory PASS | none |
| 10 | bounded proof/reuse | PASS | scan completed in one bounded run | - | receipts above | none |

Deployed trust (runtime, signing) is report-only UNAVAILABLE: offline inventory is not proof of deployed client rejection. Verdict: no blocking security findings.
