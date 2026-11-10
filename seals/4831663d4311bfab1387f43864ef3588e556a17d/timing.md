# Gate timing

Head: 4831663d4311bfab1387f43864ef3588e556a17d
Script time: 23.4s
Phase time: 59s
Idle time: 0s
Budget: WITHIN_BUDGET

## Phases

| Phase | Name | Verdict | Seconds |
|---|---|---|---|
| 0 | preflight | PASS | 0 |
| 1 | spec | PASS | 0 |
| 2 | static | PASS | 0 |
| 3 | tests | PASS | 0 |
| 4 | regression | PASS | 0 |
| 8 | security | PASS | 53 |
| 5 | review | PASS | 0 |
| 6 | zero-debt | PASS | 0 |
| 7 | react-health | SKIP | 0 |
| 9 | adversarial | PASS | 0 |
| 10 | review-verification | PASS | 0 |
| 11 | final-verification | PASS | 6 |

## Commands

| Command | Seconds | Exit | Timed out |
|---|---|---|---|
| oxlint -f default . \|\| true | 0.1 | 0 | no |
| regression (HEAD) | 2 | 0 | no |
| command | 21 | 0 | no |
| oxlint -f default . \|\| true | 0.2 | 0 | no |
| oxlint -f default . \|\| true | 0.1 | 0 | no |

## Idle gaps

none over 60s

## Attempts

1 (current: 1794315103000-38130)
