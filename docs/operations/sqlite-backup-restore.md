# SQLite 备份与恢复演练

当前云养宠生产首版使用文件型 SQLite。本流程提供一致性备份和隔离恢复校验，不会覆盖当前生产数据库。

## 创建一致性备份

先设置生产环境的 `DATABASE_URL`，再指定受限的备份目录：

```bash
npm run db:backup:sqlite -- --output-dir D:\secure\cloud-pets-backups
```

脚本使用 Prisma 在活动数据库上执行 SQLite `VACUUM INTO`，不会直接复制正在写入的数据库文件。成功后生成同名的一对文件：

- `cloud-pets-<UTC时间>-<随机后缀>.sqlite`
- `cloud-pets-<UTC时间>-<随机后缀>.manifest.json`

manifest 记录数据库 SHA-256、迁移指纹，以及云养宠核心数据域的 `count + hash`。它不包含数据库路径、手机号、姓名、正文、token、密码哈希或业务记录样本。

## 执行隔离恢复演练

manifest 与 SQLite 备份必须位于同一目录：

```bash
npm run db:restore:drill -- --manifest D:\secure\cloud-pets-backups\cloud-pets-....manifest.json
```

演练依次校验：

1. manifest 结构与同目录备份路径。
2. 文件大小和 SHA-256。
3. 临时恢复副本的 `PRAGMA quick_check`。
4. Prisma migration 的数量和指纹。
5. 会员会话、宠物、日记、照护、访问、社区、运营配置和 staff 数据域的数量与指纹。

恢复副本只会创建在系统临时目录，默认在演练结束后删除。演练不会读取 `DATABASE_URL` 指向的源库，更不会覆盖生产文件。

## 自动化验证

```bash
npm run smoke:sqlite-recovery
```

该命令在系统临时目录中预创建空 SQLite 文件、执行全部 Prisma migrations、写入代表性云养宠数据、连续创建两个备份，并重复执行隔离恢复。备份完成后它还会修改源库，以证明恢复结果来自备份时快照。默认无论成功或失败都会清理临时产物。

## 稳定错误码

| 错误码 | 含义 | 处理建议 |
| --- | --- | --- |
| `BACKUP_SHA_MISMATCH` | 备份与 manifest 不匹配 | 停止使用该文件，换用其他备份 |
| `RESTORE_QUICK_CHECK_FAILED` | SQLite 文件损坏 | 停止恢复并检查备份介质 |
| `MIGRATION_MISMATCH` | migration 指纹不一致 | 确认 manifest 与备份是否成对保存 |
| `DOMAIN_MISMATCH` | 核心数据域不一致 | 停止恢复并调查文件是否被修改 |

所有失败都会返回非零退出码，并且不会输出业务正文或认证凭据。

## 第一版边界

本流程暂不负责定时调度、异地或对象存储、备份加密、保留策略、跨版本迁移和真实生产覆盖恢复。备份文件本身仍包含完整生产数据，必须保存在非公开、权限受限且不进入 Git 的目录中。
