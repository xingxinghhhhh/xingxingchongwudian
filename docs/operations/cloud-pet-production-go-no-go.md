# 云养宠生产上线 GO/NO-GO 证据评估

该命令只读取一份脱敏的上线证据包，判断四类既有验收是否属于同一个候选版本。它不启动 Nest/Next、不执行迁移、不获取 SQLite ownership、不调用业务 API，也不读取 `.env` 或生产密钥。

## 执行

```text
npm run ops:check:cloud-pet-go-no-go -- --evidence-file <脱敏证据包路径>
```

也可以通过 stdin 传入证据包：

```text
<脱敏 JSON> | npm run ops:check:cloud-pet-go-no-go -- --stdin
```

证据包必须由运维人员在受控环境整理为 `schemaVersion: 1`，包含：

- `candidate.releaseId`：候选发布标识；
- `candidate.configFingerprint`：现有 safe-config SHA-256，不是密钥；
- `target.hostIdentity`：目标宿主机的安全标识；
- `target.databaseIdentity`：现有 host preflight 输出的脱敏数据库标识；
- `evidence.hostPreflight`：`CLOUD_PET_PRODUCTION_HOST_PREFLIGHT_PASSED`；
- `evidence.launchAcceptance`：`CLOUD_PET_LAUNCH_ACCEPTANCE_PASSED` 及七个阶段均为 `passed`；
- `evidence.coldStart`：`CLOUD_PET_COLD_START_HANDOVER_DRILL_PASSED` 及关键检查；
- `evidence.warmRestart`：`CLOUD_PET_WARM_RESTART_HANDOVER_DRILL_PASSED` 及关键检查。

四类 evidence 的 `releaseId`、`configFingerprint`、时间戳必须存在并与候选一致。Host preflight 还必须证明 safe-config 已匹配、migration compatible、端口可用、数据库标识一致且没有失败项。冷启动和暖重启不得暴露 bootstrap secret，关键检查必须全部通过。

评估器不设任意的 24 小时或 7 天有效期；证据包本身就是本次上线评估明确指定的输入。它仍要求每项带可解析时间戳，避免把无时间来源的旧 stdout 混入决策。

已有 host preflight、launch acceptance、cold-start 和 warm-restart 脚本都支持在设置 `CLOUD_PET_EVIDENCE_FILE` 时额外写出 `schemaVersion: 1` 的脱敏 JSON；未设置时原有 stdout 和验收行为不变。证据文件应放在 `.cloud-pet-evidence/` 等不入库目录，并由运维人员整理为上述证据包。若要让四类证据绑定同一个候选 release/config fingerprint，执行前必须显式准备相同的候选标识；cold/warm 演练不能把各自默认的演练标识冒充正式 release。

全部通过时唯一的成功标记是：

```text
CLOUD_PET_PRODUCTION_GO
```

任何缺失、失败、release/config 不一致、目标标识不一致、结构非法或出现 password/token/session/cookie/secret 等敏感字段时返回非零并输出 `CLOUD_PET_PRODUCTION_NO_GO`。输出只包含 reason code 和脱敏摘要，不回显输入 evidence 原文。

该命令不是 startup gate，也不能替代目标宿主机上的 `ops:check:cloud-pet-production-host`、冷启动接管、暖重启接管或发布冻结验收。当前 Windows 开发机上的单测只能证明评估器逻辑，不能单独签发正式生产 GO。
