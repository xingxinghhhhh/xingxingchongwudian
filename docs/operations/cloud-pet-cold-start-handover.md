# 云养宠冷启动接管演练

这份 runbook 用于验证商家从全新生产数据库开始，能够完成一次受控接管并进入真实云养宠运营。它与 `verify:cloud-pet-launch` 的职责不同：发布门禁验证当前提交，冷启动演练验证运维人员能否从空库完成首次接管。

## 隔离演练

在仓库根目录执行：

```text
npm run ops:drill:cloud-pet-cold-start
```

该命令会：

1. 构建当前后端发布产物。
2. 在系统临时目录创建全新的 SQLite 数据库和本地验证码 webhook。
3. 使用正式 `prisma migrate deploy` 完成数据库迁移。
4. 使用现有 `ops:bootstrap:admin-owner` 命令创建首个 Owner。
5. 重复执行 bootstrap，确认第二次操作非零失败且不会创建第二个 Owner。
6. 在 Nest/Next runtime 环境中移除 Owner bootstrap email/password 后启动生产进程。
7. 检查 liveness、readiness、deployment readiness 和 launch readiness。
8. 通过真实 `/admin/login` 页面建立 Owner StaffSession。
9. 通过真实会员验证码页面创建一只云养宠，完成一次照护任务并看到今日日记。
10. 通过 Prisma 只读核对 Owner、宠物、照护任务和 `care_daily_diary` 已落库。

成功时只输出不含凭据、验证码、session、手机号或宠物编号的摘要，并包含：

```text
CLOUD_PET_COLD_START_HANDOVER_DRILL_PASSED
```

演练默认结束后删除自己的临时目录。设置 `KEEP_CLOUD_PET_COLD_START_DRILL=1` 可以保留临时目录用于故障排查；该命令不会读取、覆盖或清理 `prisma/dev.db`，也不会执行 `git clean`、`git reset` 或删除工作区运行产物。

## 生产接管顺序

真实生产部署使用部署平台提供的 `DATABASE_URL` 和 runtime 配置，按以下顺序执行：

1. 应用当前发布产物并执行 `npm run prisma:migrate:deploy`。
2. 仅在首次没有 active Owner 的数据库上，临时提供 `ADMIN_OWNER_NAME`、`ADMIN_OWNER_EMAIL`、`ADMIN_OWNER_PASSWORD`。
3. 执行 `npm run ops:bootstrap:admin-owner`，确认输出成功后立即从长期 runtime 配置中移除 Owner email/password。
4. 使用正常生产启动命令启动 Nest API 和 Next Web；API 启动会继续校验 active Owner、release、safe config 和 migration compatibility。
5. 检查 `/api/health/live`、`/api/health/ready`，再通过 `/admin/login` 完成 Owner 登录。
6. 在 Admin 中确认 deployment/launch readiness，再通过 `/cloud-pets` 完成一条会员照护路径。

Owner bootstrap 是一次性接管操作，不是 Staff CRUD，也不是公网 API。已有 Owner 的数据库不得再次执行创建流程；后续登录、权限和运营操作全部走现有 StaffSession 与 Owner/Operator 权限体系。

## 最近证据

最近一次隔离演练通过：

```text
code: CLOUD_PET_COLD_START_HANDOVER_DRILL_PASSED
emptyDatabaseMigrated: true
bootstrapCreatedOneOwner: true
duplicateBootstrapRejected: true
runtimeOwnerSecretsPresent: false
readiness: true
ownerLogin: true
memberLogin: true
cloudPetCreated: true
careDiaryVisible: true
ownerCount: 1
petCount: 1
careTaskCount: 1
careDiaryCount: 1
```

该证据来自全新临时数据库，不代表当前开发数据库或任何真实生产数据库的数据状态。
