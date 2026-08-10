# 云养宠生产部署状态

Owner 登录商家后台后，可在「生产部署状态」卡片查看当前实例是否按生产契约启动。

接口为 `GET /api/admin/ops/deployment-readiness`，使用后台 Staff Session 和 `audit:read` 权限，并返回 `Cache-Control: no-store`。它只投影布尔状态和安全的运行模式，不返回数据库 URL、Webhook 地址或 token、CORS 原值、备份路径、密码或 session。

状态由现有真源聚合：

- `DatabaseHealthService` 提供真实 Prisma/SQLite 模式和数据库 readiness。
- `validateEnvironment` 继续负责生产启动门禁；本接口不复制生产校验规则。
- 应用内没有共享 migration drift helper，因此 migration 门禁仍由现有部署 smoke/迁移流程负责。
- 数据保护状态目录是可选配置，未配置时单项显示“未配置”，不会单独把部署状态判为异常。

`status=ready` 需要 Production、Prisma/SQLite、数据库 ready，以及当前生产必需配置均已配置；否则返回 `attention`。该卡片只读，支持手动刷新，不提供在线修改配置、重启进程或迁移数据库的操作。
