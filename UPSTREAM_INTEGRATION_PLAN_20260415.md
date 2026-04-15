# Upstream Integration Plan (Audit-first) - 2026-04-15

Upstream commits pending: 41

## Safe-first batch (candidate)
- 29f19dd fix: unify page header styles across all views
- 456a7ef docs: add official API integration TODO checklist
- 9dd5fca feat: add usage statistics page, CLI improvements, and UI enhancements
- e19b532 chore: bump version to 0.2.0-beta.1
- 5143a26 Merge pull request #3 from cl1107/main
- 600ec05 feat(chat): 修复输入法回车发送消息的问题
- f22a497 fix: add missing axios dependency and bump version to 0.1.9
- 94329ad fix: remove duplicate sourceLabel declaration in ChatPanel
- f828c73 Merge branch 'dev'
- 4793b91 add
- 80c9f21 Merge branch 'dev'
- 32060a5 docs: update demo GIF and link
- f0d2ed7 Merge branch 'dev'
- cf41d79 docs: format README tables and spacing
- 6916310 Merge branch 'dev'
- 11e0b65 chore: update demo GIF
- 9e069a2 feat: add model management module with provider CRUD
- 9a3d5ef docs: fix Hermes Agent repo link
- 3a17d8a docs: fix Hermes Agent repo link
- 7737fe1 docs: add demo GIF to README

## Review-required batch
- c0f1453 fix: graceful shutdown for nodemon restart to prevent EADDRINUSE
- 2487e14 fix: prevent Windows terminal popups with windowsHide option
- f8fc64f fix: remove set -e from setup script to prevent early exit
- 8f8cf62 feat: WSL support, js-yaml migration, and stability improvements
- 60056e7 feat: auto-install hermes-web-ui via npm in setup script
- 91e5f63 feat: add environment setup script for auto-detecting and installing Node.js
- 0ff0475 feat: add gateway auto-start on boot and real health detection

## High-risk batch (manual security review required)
- 62e0d6f fix: pass auth token via query param for SSE EventSource
- 66cc9a6 fix: generate token on start, include token in URL, reset api_server config
- 1f45254 feat: add token auth, login page, skill toggle, and route restructure
- be4624b Merge branch 'dev' into feat/official-api
- e89a240 feat: add i18n, platform channels page, and WeChat QR login

## Rule
- Merge order: Safe -> Review -> High-risk
- Every batch requires build + typecheck + health check + security grep before moving on.