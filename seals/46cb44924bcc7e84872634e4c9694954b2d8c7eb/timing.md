# Gate timing

Head: 46cb44924bcc7e84872634e4c9694954b2d8c7eb
Script time: 8.2s
Phase time: 0s
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
| 7 | react-health | SKIP | 0 |
| 5 | review | PASS | 0 |
| 8 | security | PASS | 0 |
| 9 | adversarial | PASS | 0 |
| 10 | review-verification | PASS | 0 |
| 6 | zero-debt | PASS | 0 |
| 11 | final-verification | PASS | 0 |

## Commands

| Command | Seconds | Exit | Timed out |
|---|---|---|---|
| oxlint -f default . \|\| true | 0.1 | 0 | no |
| regression (HEAD) | 1.8 | 0 | no |
| command | 6.2 | 0 | no |
| oxlint -f default . \|\| true | 0.1 | 0 | no |

## Idle gaps

none over 60s

## Attempts

1 (current: 1794340392000-3412)
