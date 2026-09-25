---
"@gommage/core": patch
---

Only replace the committer identity on commits that are already being rewritten, so `gommage fix` no longer plans commits with no policy violation.
