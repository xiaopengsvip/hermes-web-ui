     1|# Upstream + Local Audit Report (2026-04-15)
     2|
     3|## Scope
     4|- Local repo: xiaopengsvip/hermes-web-ui (branch: main)
     5|- Upstream repo: EKKOLearnAI/hermes-web-ui (branch: main)
     6|- Objective: audit first, then integrate upstream + local capability + local data conventions.
     7|
     8|## Divergence Snapshot
     9|- ahead/behind (origin/main...upstream/main): 18 / 41
    10|- Upstream commits not in local main: 41
    11|- High overlap files (`git merge-tree` changed in both): 30 files
    12|
    13|Top overlap files include:
    14|- server/src/index.ts
    15|- server/src/routes/filesystem.ts
    16|- src/App.vue
    17|- src/components/layout/AppSidebar.vue
    18|- src/views/SettingsView.vue
    19|- src/components/chat/*
    20|
    21|## Security/Risk Flags in Upstream Delta (automated pattern scan)
    22|Flagged commits requiring manual review before merge/cherry-pick:
    23|
    24|1) 62e0d6f  fix: pass auth token via query param for SSE EventSource
    25|   - Risk: token in URL/query string
    26|
    27|2) 66cc9a6  fix: generate token on start, include token in URL, reset api_server config
    28|   - Risk: token in URL, process spawning path, auth token bootstrap logic
    29|
    30|3) 1f45254  feat: add token auth, login page, skill toggle, and route restructure
    31|   - Risk: auth model changed substantially (must reconcile with existing local auth/session model)
    32|
    33|4) 2487e14 / 9dd5fca / 8f8cf62
    34|   - Risk: process spawn/CLI startup behavior touched
    35|
    36|## Local Working Tree Audit Snapshot
    37|Local security quick scan on unstaged changes found process-spawn usage in auth oauth flow path.
    38|Action: keep, but require strict input allowlist + fixed interpreter path + redacted logs + timeout.
    39|
    40|## Audit-First Integration Decision
    41|Do NOT direct-merge upstream/main now.
    42|
    43|Use staged integration with audit gates:
    44|1. Freeze local baseline (commit current in-progress UI/auth work).
    45|2. Create `integration/upstream-20260415` branch.
    46|3. Import upstream changes in 3 buckets:
    47|   - A) Safe UI/layout changes
    48|   - B) Runtime/process changes (manual audit required)
    49|   - C) Auth/token model changes (manual security review required)
    50|4. For each bucket run:
    51|   - static grep security checks
    52|   - build + typecheck
    53|   - health endpoint verification
    54|5. Final pre-merge independent review (delegate reviewer).
    55|
    56|## Recommended Keep/Drop Rules
    57|- KEEP from upstream:
    58|  - generic UI fixes
    59|  - Windows/WSL stability improvements that do not weaken auth
    60|- REVIEW BEFORE KEEP:
    61|  - EventSource token via query (prefer short-lived signed token or header-based alternative where possible)
    62|  - auth bootstrap/token storage model changes
    63|- DROP or rewrite:
    64|  - any auth weakening, any token leakage via logs/URL/history/referrer
    65|
    66|## Next Execution Plan
    67|- Step 1: commit current local changes as audited baseline.
    68|- Step 2: open integration branch and cherry-pick safe upstream commits first.
    69|- Step 3: run security gate before each risky commit adoption.
    70|- Step 4: deploy and verify in hermes-web-ui.service.
    71|

## Review batch audit notes (executed)

- c0f1453 fix: graceful shutdown for nodemon restart to prevent EADDRINUSE
  - files: package.json, server/src/index.ts
  - flags: config write
- 2487e14 fix: prevent Windows terminal popups with windowsHide option
  - files: bin/hermes-web-ui.mjs, package.json, server/src/services/hermes-cli.ts
  - flags: spawn/exec
- f8fc64f fix: remove set -e from setup script to prevent early exit
  - files: scripts/setup.sh
  - flags: none
- 8f8cf62 feat: WSL support, js-yaml migration, and stability improvements
  - files: bin/hermes-web-ui.mjs, package.json, server/src/index.ts, server/src/routes/filesystem.ts, server/src/services/hermes-cli.ts
  - flags: spawn/exec, auth/token, config write
- 60056e7 feat: auto-install hermes-web-ui via npm in setup script
  - files: scripts/setup.sh
  - flags: none
- 91e5f63 feat: add environment setup script for auto-detecting and installing Node.js
  - files: scripts/setup.sh
  - flags: none
- 0ff0475 feat: add gateway auto-start on boot and real health detection
  - files: server/src/index.ts, server/src/services/hermes-cli.ts, server/src/shared/providers.ts, src/shared/providers.ts, src/stores/app.ts
  - flags: none
