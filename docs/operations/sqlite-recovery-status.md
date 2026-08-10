# SQLite 恢复状态

配置 `SQLITE_RECOVERY_STATUS_DIR` 后，Owner 后台会读取该固定目录中的备份
manifest 和同名 `.restore-check.json` attestation，展示最新备份是否通过隔离恢复演练。

备份新鲜度使用 `SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS` 配置，缺省为 24 小时，允许范围为
1 到 720 小时。它只判断最新备份时间是否超过窗口，不改变恢复演练的成功/失败判定。

状态含义：

- `recoverable`：最新备份存在，并且对应 manifest 已通过恢复演练。
- `backup_unverified`：发现备份，但没有与当前 manifest 匹配的 attestation。
- `drill_failed`：当前 manifest 最近一次恢复演练失败。
- `no_backup`：目录可读但没有有效备份 manifest。
- `unavailable`：没有配置目录或目录不可读。

后台接口是 `GET /api/admin/ops/sqlite-recovery-status`，只允许拥有
`audit:read` 的 Owner 访问，响应不包含文件路径、数据库地址、文件名或业务数据。
该接口只读，不会执行备份、恢复或删除操作。

Owner 也可以显式调用 `POST /api/admin/ops/sqlite-recovery/run` 创建并验证一次新备份。
接口会在当前进程内阻止并发执行，成功后返回安全的状态摘要；失败会保留真实的
backup/attestation 结果并写入 `ops.sqlite_recovery.run` 操作日志。该动作不是自动备份，
不会自动调度、自动重试或覆盖生产数据库。未配置恢复目录时不会执行操作。

恢复演练脚本成功或失败后会在 manifest 同目录写入 attestation。attestation 只保存
manifest 文件名、manifest SHA-256、检查时间、状态和稳定错误码，用于确认结果属于当前
manifest，避免旧演练结果误标记新备份。
