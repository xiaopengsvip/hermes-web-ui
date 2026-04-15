# Upstream + Local Audit Report (2026-04-15)

## Scope
- Local repo: xiaopengsvip/hermes-web-ui (branch: main)
- Upstream repo: EKKOLearnAI/hermes-web-ui (branch: main)
- Objective: audit first, then integrate upstream + local capability + local data conventions.

## Divergence Snapshot
- ahead/behind (origin/main...upstream/main): 18 / 41
- Upstream commits not in local main: 41
- High overlap files (`git merge-tree` changed in both): 30 files

Top overlap files include:
- server/src/index.ts
- server/src/routes/filesystem.ts
- src/App.vue
- src/components/layout/AppSidebar.vue
- src/views/SettingsView.vue
- src/components/chat/*

## Security/Risk Flags in Upstream Delta (automated pattern scan)
Flagged commits requiring manual review before merge/cherry-pick:

1) 62e0d6f  fix: pass auth token via query param for SSE EventSource
   - Risk: token in URL/query string

2) 66cc9a6  fix: generate token on start, include token in URL, reset api_server config
   - Risk: token in URL, process spawning path, auth token bootstrap logic

3) 1f45254  feat: add token auth, login page, skill toggle, and route restructure
   - Risk: auth model changed substantially (must reconcile with existing local auth/session model)

4) 2487e14 / 9dd5fca / 8f8cf62
   - Risk: process spawn/CLI startup behavior touched

## Local Working Tree Audit Snapshot
Local security quick scan on unstaged changes found process-spawn usage in auth oauth flow path.
Action: keep, but require strict input allowlist + fixed interpreter path + redacted logs + timeout.

## Audit-First Integration Decision
Do NOT direct-merge upstream/main now.

Use staged integration with audit gates:
1. Freeze local baseline (commit current in-progress UI/auth work).
2. Create `integration/upstream-20260415` branch.
3. Import upstream changes in 3 buckets:
   - A) Safe UI/layout changes
   - B) Runtime/process changes (manual audit required)
   - C) Auth/token model changes (manual security review required)
4. For each bucket run:
   - static grep security checks
   - build + typecheck
   - health endpoint verification
5. Final pre-merge independent review (delegate reviewer).

## Recommended Keep/Drop Rules
- KEEP from upstream:
  - generic UI fixes
  - Windows/WSL stability improvements that do not weaken auth
- REVIEW BEFORE KEEP:
  - EventSource token via query (prefer short-lived signed token or header-based alternative where possible)
  - auth bootstrap/token storage model changes
- DROP or rewrite:
  - any auth weakening, any token leakage via logs/URL/history/referrer

## Next Execution Plan
- Step 1: commit current local changes as audited baseline.
- Step 2: open integration branch and cherry-pick safe upstream commits first.
- Step 3: run security gate before each risky commit adoption.
- Step 4: deploy and verify in hermes-web-ui.service.
