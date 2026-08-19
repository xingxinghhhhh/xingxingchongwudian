# 云养宠生产宿主机上线前置条件预检

该命令检查当前发布目录和目标宿主机是否满足云养宠的 SQLite 单实例生产运行契约。它是部署前的预测检查，不替代 Nest 启动时已有的 production startup gate。

## 执行

先在正式发布目录准备好生产环境变量，并确认：

- `NODE_ENV=production`；
- `DATABASE_URL` 指向正式 SQLite 文件，不能是 `prisma/dev.db`；
- `CLOUD_PET_RELEASE_ID` 与后端构建时使用的 release ID 一致；
- `CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256` 使用当前正式安全配置计算；
- `PORT` 与可选的 `WEB_PORT` 分别对应 API 和 Next 监听端口；未设置时检查 `3000` 和 `3001`；
- 正式 API 已完成 `npm run build`，前端已完成 `npm run web:build`；
- 数据库已按正式流程完成 `npm run prisma:migrate:deploy`。

执行：

```text
npm run ops:check:cloud-pet-production-host
```

## 检查内容

预检会复用现有生产配置校验、SQLite 路径解析、runtime ownership、safe-config fingerprint 和 Prisma migration compatibility。它还会：

- 检查 API/Web 端口当前没有被占用；
- 在 SQLite 父目录创建、同步、读取并删除一个本次专属的临时探针文件；
- acquire/release 一次现有 SQLite runtime ownership，并确认没有残留 lock；
- 读取 migration 状态并执行只读 `prisma migrate diff`；
- 检查 API/Next 发布产物和 release marker。

预检不会启动 Nest/Next，不会执行 Owner bootstrap，不会执行 migration，不会调用业务 API，也不会写 Prisma 业务表。它只删除自己创建的唯一探针文件。

## 结果

所有检查通过时输出：

```text
CLOUD_PET_PRODUCTION_HOST_PREFLIGHT_PASSED
```

失败时返回非零退出码并输出脱敏 JSON。证据只包含检查名、稳定的数据库路径摘要、端口、release ID、版本和状态；不会输出密码、验证码、session、cookie、token 或完整环境变量。

失败后不得继续上线：宿主机目录、端口或运行进程问题应先修复宿主机；配置、release、构建产物或 migration diff 问题应回到发布配置/代码处理。

该检查在开发机上的通过只证明开发机当前满足检查条件；正式上线证据必须在目标生产宿主机或与其等价的发布环境执行。通过后仍需按既有顺序执行冷启动接管和发布冻结验收。
