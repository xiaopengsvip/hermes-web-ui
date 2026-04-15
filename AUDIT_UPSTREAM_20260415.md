     1|     1|# Upstream + Local Audit Report (2026-04-15)
     2|     2|
     3|     3|## Scope
     4|     4|- Local repo: xiaopengsvip/hermes-web-ui (branch: main)
     5|     5|- Upstream repo: EKKOLearnAI/hermes-web-ui (branch: main)
     6|     6|- Objective: audit first, then integrate upstream + local capability + local data conventions.
     7|     7|
     8|     8|## Divergence Snapshot
     9|     9|- ahead/behind (origin/main...upstream/main): 18 / 41
    10|    10|- Upstream commits not in local main: 41
    11|    11|- High overlap files (`git merge-tree` changed in both): 30 files
    12|    12|
    13|    13|Top overlap files include:
    14|    14|- server/src/index.ts
    15|    15|- server/src/routes/filesystem.ts
    16|    16|- src/App.vue
    17|    17|- src/components/layout/AppSidebar.vue
    18|    18|- src/views/SettingsView.vue
    19|    19|- src/components/chat/*
    20|    20|
    21|    21|## Security/Risk Flags in Upstream Delta (automated pattern scan)
    22|    22|Flagged commits requiring manual review before merge/cherry-pick:
    23|    23|
    24|    24|1) 62e0d6f  fix: pass auth token via query param for SSE EventSource
    25|    25|   - Risk: token in URL/query string
    26|    26|
    27|    27|2) 66cc9a6  fix: generate token on start, include token in URL, reset api_server config
    28|    28|   - Risk: token in URL, process spawning path, auth token bootstrap logic
    29|    29|
    30|    30|3) 1f45254  feat: add token auth, login page, skill toggle, and route restructure
    31|    31|   - Risk: auth model changed substantially (must reconcile with existing local auth/session model)
    32|    32|
    33|    33|4) 2487e14 / 9dd5fca / 8f8cf62
    34|    34|   - Risk: process spawn/CLI startup behavior touched
    35|    35|
    36|    36|## Local Working Tree Audit Snapshot
    37|    37|Local security quick scan on unstaged changes found process-spawn usage in auth oauth flow path.
    38|    38|Action: keep, but require strict input allowlist + fixed interpreter path + redacted logs + timeout.
    39|    39|
    40|    40|## Audit-First Integration Decision
    41|    41|Do NOT direct-merge upstream/main now.
    42|    42|
    43|    43|Use staged integration with audit gates:
    44|    44|1. Freeze local baseline (commit current in-progress UI/auth work).
    45|    45|2. Create `integration/upstream-20260415` branch.
    46|    46|3. Import upstream changes in 3 buckets:
    47|    47|   - A) Safe UI/layout changes
    48|    48|   - B) Runtime/process changes (manual audit required)
    49|    49|   - C) Auth/token model changes (manual security review required)
    50|    50|4. For each bucket run:
    51|    51|   - static grep security checks
    52|    52|   - build + typecheck
    53|    53|   - health endpoint verification
    54|    54|5. Final pre-merge independent review (delegate reviewer).
    55|    55|
    56|    56|## Recommended Keep/Drop Rules
    57|    57|- KEEP from upstream:
    58|    58|  - generic UI fixes
    59|    59|  - Windows/WSL stability improvements that do not weaken auth
    60|    60|- REVIEW BEFORE KEEP:
    61|    61|  - EventSource token via query (prefer short-lived signed token or header-based alternative where possible)
    62|    62|  - auth bootstrap/token storage model changes
    63|    63|- DROP or rewrite:
    64|    64|  - any auth weakening, any token leakage via logs/URL/history/referrer
    65|    65|
    66|    66|## Next Execution Plan
    67|    67|- Step 1: commit current local changes as audited baseline.
    68|    68|- Step 2: open integration branch and cherry-pick safe upstream commits first.
    69|    69|- Step 3: run security gate before each risky commit adoption.
    70|    70|- Step 4: deploy and verify in hermes-web-ui.service.
    71|    71|
    72|
    73|## Review batch audit notes (executed)
    74|
    75|- c0f1453 fix: graceful shutdown for nodemon restart to prevent EADDRINUSE
    76|  - files: package.json, server/src/index.ts
    77|  - flags: config write
    78|- 2487e14 fix: prevent Windows terminal popups with windowsHide option
    79|  - files: bin/hermes-web-ui.mjs, package.json, server/src/services/hermes-cli.ts
    80|  - flags: spawn/exec
    81|- f8fc64f fix: remove set -e from setup script to prevent early exit
    82|  - files: scripts/setup.sh
    83|  - flags: none
    84|- 8f8cf62 feat: WSL support, js-yaml migration, and stability improvements
    85|  - files: bin/hermes-web-ui.mjs, package.json, server/src/index.ts, server/src/routes/filesystem.ts, server/src/services/hermes-cli.ts
    86|  - flags: spawn/exec, auth/token, config write
    87|- 60056e7 feat: auto-install hermes-web-ui via npm in setup script
    88|  - files: scripts/setup.sh
    89|  - flags: none
    90|- 91e5f63 feat: add environment setup script for auto-detecting and installing Node.js
    91|  - files: scripts/setup.sh
    92|  - flags: none
    93|- 0ff0475 feat: add gateway auto-start on boot and real health detection
    94|  - files: server/src/index.ts, server/src/services/hermes-cli.ts, server/src/shared/providers.ts, src/shared/providers.ts, src/stores/app.ts
    95|  - flags: none
    96|

## Integration execution status

- Safe batch attempted commits: 5
  - Applied cleanly: `456a7ef` (docs only)
  - Conflict-aborted: `29f19dd`, `94329ad`, `600ec05`, `f22a497`
  - Note: `600ec05` + `f22a497` already represented in local history (`0768554` includes IME fix and axios path)

- Review batch trial:
  - `c0f1453` cherry-pick attempted, conflict on `package.json` and `server/src/index.ts`, then aborted.
  - Decision: keep review/high-risk commits in manual mapping queue (audit-first).
