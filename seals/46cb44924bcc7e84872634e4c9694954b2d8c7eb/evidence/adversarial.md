# Adversarial pass
Concurrency: stateless command, no shared state. Boundary: empty or missing id rejected before request; ids with slashes are encoded by the shared builder. State corruption: read-only GET. Error path: non-2xx handled by the shared client as for email-state. Contract: command count 227 and operation count 220 asserted in release-contract and parity tests, which pass.
No confirmed bug.
