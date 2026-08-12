# 云养宠生产暖重启接管演练

这份演练验证已有云养宠业务数据在计划内维护重启后仍可继续运营：Nest runtime A 正常停止并释放 SQLite ownership，runtime B 使用同一个 SQLite 数据库、但不携带 Owner bootstrap 凭据重新接管。

## 隔离演练

在仓库根目录执行：

```text
npm run ops:drill:cloud-pet-warm-restart
```

命令会在临时目录中完成正式 migration、一次性 Owner bootstrap、重复 bootstrap 拒绝、生产 Web 构建，然后通过真实 `/admin/login`、会员验证码路径和 `/cloud-pets` 页面创建一只云宠并完成一次照护任务。随后它会：

1. 读取 Owner、会员、宠物、任务完成和 `care_daily_diary` 的非敏感前置证据；
2. 通过受控的本地 IPC 消息调用现有 Nest `app.close()` 生命周期，等待 runtime A 正常退出；
3. 确认 SQLite ownership 文件已释放；
4. 在完全相同的 SQLite 数据库上、无 Owner bootstrap email/password 的环境中启动 runtime B；
5. 重新通过 Owner 登录和会员登录访问 Admin 与同一只云宠，确认照护日记仍存在；
6. 以 Prisma 只读方式确认 Owner 仍为一个、宠物与任务完成仍存在，且重启没有额外生成 `care_daily_diary`。

成功时只输出：

```text
CLOUD_PET_WARM_RESTART_HANDOVER_DRILL_PASSED
```

演练不会读取、覆盖或清理 `prisma/dev.db`，也不会使用临时 SQL、Prisma Studio 或测试 seed 伪造会员、宠物、任务或日记。默认结束时只删除本次创建的临时目录；设置 `KEEP_CLOUD_PET_WARM_RESTART_DRILL=1` 可保留本次临时目录用于排查。

## 真实生产切换顺序

生产切换仍由平台的进程管理器执行：先发送正常停止信号并确认旧 Nest 进程退出，再启动指向同一 SQLite 路径的新 Nest runtime，最后检查 `/api/health/live`、`/api/health/ready` 和 Admin 的部署/启动就绪状态。不能在旧实例仍持有数据库时启动第二个实例，也不能手工删除 ownership 文件绕过门禁。

本演练只验证单实例 SQLite 的计划内交接，不等同于高可用、版本回滚、数据库迁移兼容矩阵或备份恢复演练。
