# SQLite 生产单实例启动互斥

当前生产运行模型使用 SQLite 单实例。一个生产数据库只能由一个长期 Nest runtime 持有；第二个指向同一数据库的 runtime 必须在提供业务流量前启动失败。

## 验证命令

```text
npm run ops:check:cloud-pet-sqlite-single-instance
```

该命令在系统临时目录创建两个隔离 SQLite 数据库，执行正式 Prisma migration，并用 production 配置启动 API：

1. 启动第一个 runtime，确认 readiness 通过。
2. 用同一个数据库启动第二个 runtime，确认非零退出并输出 `SQLITE_RUNTIME_OWNERSHIP_CONFLICT`。
3. 确认第一个 runtime 在冲突期间仍保持 readiness。
4. 用另一个数据库启动独立 runtime，确认不是全机器级单例。
5. 停止第一个 runtime，再启动替代 runtime，确认 ownership 已释放且 readiness 恢复。

runtime ownership 使用数据库最终规范化路径旁的临时锁文件，记录进程 PID 和随机 token。正常退出会释放锁；异常退出后的遗留记录只有在持有进程已不存在时才会被清理。锁文件不属于 Prisma schema、migration、业务备份或 Git 内容。

## 生产切换顺序

- 同一 SQLite 数据库只启动一个 Nest runtime。
- 先停止旧 runtime，确认进程已经退出，再启动新 runtime。
- 第二个 runtime 报 `SQLITE_RUNTIME_OWNERSHIP_CONFLICT` 时，不要手工删除锁文件；先确认记录中的持有进程不存在，再按平台运维流程处理。
- Next Web 不持有 SQLite，不受该互斥限制；Member/Staff 权限和 API contract 不变。

该门禁不改变 `prisma/dev.db`，也不要求清理仓库中的既有运行产物。成功输出：

```text
CLOUD_PET_SQLITE_SINGLE_INSTANCE_PASSED
```
