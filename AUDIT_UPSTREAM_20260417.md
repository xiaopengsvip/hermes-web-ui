# AUDIT_UPSTREAM_20260417

本文件记录 `xiaopengsvip/hermes-web-ui` 与上游 `EKKOLearnAI/hermes-web-ui` 的当日审计结果（先审计后集成）。

## 1) Divergence（2026-04-17）
- 本地分支：`main`
- origin/main 领先 upstream/main：33 提交
- upstream/main 领先 origin/main：74 提交
- 本地 `main..upstream/main` 可见上游未合入提交：60（去掉 merge 提交后）

## 2) 安全风险审计（关键词 + 提交级审查）
对 `main..upstream/main` 做了提交级关键词扫描：
- 关键词：`token|Authorization|Bearer|password|secret|spawn|exec|child_process|shell:true|eval|innerHTML|EventSource|?token=`

命中高风险/中风险提交：
1. `62e0d6f` - `fix: pass auth token via query param for SSE EventSource`
   - 风险：token 进入 query 参数，存在日志/历史/代理泄露面
2. `66cc9a6` - `fix: generate token on start, include token in URL, reset api_server config`
   - 风险：token 出现在 URL，风险同上
3. `1f45254` - `feat: add token auth, login page, skill toggle, and route restructure`
   - 风险：鉴权链路变更幅度大，需逐文件人工审计

结论：
- 不直接 merge 上游主线。
- 对涉及 token URL 透传方案默认拒绝，保持本地既有鉴权与接口能力。
- 仅分桶吸收低风险 UI/文案与兼容性修复。

## 3) 本地能力保留约束
合并/吸收上游时必须保留：
- `/api/auth/add` + OAuth 设备码 start/poll/cancel 全链路
- auth 元数据展示（含 expires_at/status/reset_at）
- 当前 WSL/服务启动路径与健康检查逻辑

## 4) 门禁验证
- 审计已完成：✅
- 本轮代码改动将执行构建验证：`npm run build`（见本次提交记录）

## 5) 处置策略
- 策略：Audit First + 分桶吸收（A低风险UI → B兼容层 → C鉴权高风险）
- 发布前要求：构建通过、无明文密钥提交、关键路由可用
