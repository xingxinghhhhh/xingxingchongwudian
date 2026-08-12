# 云养宠发布冻结验收门禁

使用唯一正式命令执行当前云养宠 MVP 的发布候选验收：

```bash
npm run verify:cloud-pet-launch
```

命令按顺序调用现有验证入口：

1. 后端单测
2. API E2E
3. Playwright UI E2E（固定单 worker）
4. 后端构建
5. 前端构建
6. 生产浏览器 smoke（临时 SQLite、Prisma migration、Nest/Next production 和真实会员/Admin 链路）
7. `git diff --check`

任一阶段返回非零时，门禁立即失败且不会输出 `CLOUD_PET_LAUNCH_ACCEPTANCE_PASSED`。门禁只编排现有命令，不新增业务 API、权限、数据表或第二套 production smoke。

命令不会清理或提交以下既存运行产物：

- `.codex-api-dev.log`
- `.codex-web-dev.log`
- `prisma/dev.db`
- `test-results/`
- `web/tsconfig.tsbuildinfo`
