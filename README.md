# 奶盖和年糕的 AI 成长日记

这个仓库是 `奶盖和年糕` 云养宠产品的主仓库，当前主线是可上线的云养宠留存系统，商城作为下游转化能力保留。

它包含两部分：

- `web/`：Next.js 用户端与商家后台。
- `src/`：NestJS API，包含会员、云养宠、日记、社区、后台运营和商城能力。
- `prisma/`：SQLite 数据模型与迁移。
- `web-e2e/`：Playwright 页面级自动化测试。

同时，原本放在 `D:\AI\奶盖和年糕的成长日记` 的品牌内容库已经迁入当前仓库，作为网站和内容运营的统一素材源。

## 当前云养宠能力

- `/cloud-pets`：会员同步、宠物创建、每日照护、日记归档、主页编辑与社区互动工作台。
- `/cloud-pets/[petNo]`：可分享的宠物公开主页。
- `/member`：会员、积分、通知与云养宠摘要。
- `/admin`：员工 session 保护的商家后台，包含云养宠运营、日记缺口补救、社区审核和配置管理。
- 后端支持数据库与测试内存模式；生产环境会拒绝缺失数据库、默认管理员凭据和本地 CORS 配置。

## 品牌内容库

迁移后的品牌资料在：

- `brand/naigai-niangao/`

其中包括：

- `source/`
  - 原始项目目录的完整拷贝
- `character-profile.md`
  - 角色设定与世界观
- `prompt-master.txt`
  - 统一画风提示词母版
- `first-five-video-scripts.txt`
  - 前 5 条短视频脚本

站点可直接使用的图片素材在：

- `web/public/brand/naigai-niangao/`

## 本地开发

```bash
npm install
npm run prisma:generate
npm run web:dev
npm run api:dev
```

本地地址：

- Web: `http://localhost:3001`
- API: `http://localhost:3000/api`

## 验证命令

```bash
npm test -- --runInBand
npm run test:e2e
npm run test:ui
npm run build
npm run web:build
npm run prisma:validate
```

## 生产配置

以 `.env.example` 为模板配置环境变量。生产环境至少需要：

- `DATABASE_URL`
- `ADMIN_API_KEY`
- `WEB_ORIGIN`
- `ADMIN_OWNER_EMAIL`
- `ADMIN_OWNER_PASSWORD`
- `MEMBER_AUTH_PROVIDER=webhook`
- `MEMBER_AUTH_CODE_SECRET`
- `MEMBER_AUTH_WEBHOOK_URL`
- `MEMBER_AUTH_WEBHOOK_TOKEN`
- `TRUST_PROXY_HOPS`，直连部署填 `0`，经过一层可信反向代理填 `1`

部署前执行：

```bash
npm run prisma:migrate:deploy
npm run build
npm run web:build
npm run smoke:production
```

`smoke:production` 会使用隔离的临时 SQLite 数据库，执行完整迁移并检查 migration drift，启动 API 与 Next 生产构建，检查 readiness、云养宠工作台和后台登录页，并通过本地短信 webhook 完成真实验证码挑战。脚本还会验证生产响应不泄露验证码、admin/member session 与云养宠运营配置跨重启持久化，以及两类 session 在 logout 后立即失效。

部署平台可使用：

- 存活探针：`GET /api/health/live`
- 就绪探针：`GET /api/health/ready`，数据库查询失败时返回 `503`

API 会在响应中返回 `X-Request-Id`。生产环境自动输出不包含请求体和查询参数的结构化访问日志；开发环境可通过 `REQUEST_LOGGING=true` 开启。

生产环境必须按实际网络拓扑设置 `TRUST_PROXY_HOPS`，Express 才会从可信代理链解析客户端 IP。验证码和匿名写接口的 IP 限流依赖该配置；配置错误可能导致共享代理后的用户被归为同一来源。

生产 staff 账号和 admin session 使用数据库持久化；密码采用带随机盐的 `scrypt`，session 支持过期、disabled staff 即时失效和 logout 撤销。`ADMIN_SESSION_TTL_HOURS` 默认值为 `12`。

会员登录必须先完成一次性短信验证码挑战。验证码只保存 HMAC 哈希，默认 5 分钟过期、最多尝试 5 次、成功后立即失效；生产环境通过 HTTPS webhook adapter 发送，开发/测试环境才会返回测试码。后台 dashboard 展示近 24 小时的发码、成功、活跃、过期、锁定和错误尝试指标。

云养宠创建同样要求有效 member session，后端始终以 session 身份覆盖客户端提交的主人信息。云养宠工作台的“切换”会撤销服务端 session，页面刷新不会再凭本地姓名和手机号自动恢复登录。

认证会员每个 session 每小时最多创建 5 只云养宠，超限返回 `429`。社区与云养宠共享统一的限流基础配置，按 member session 独立计数。

公开宠物主页使用浏览器匿名访客 ID 记录访问，后端只保存哈希，并按“宠物、来源、访客、日期”唯一计数；同一浏览器当天重复刷新不会抬高运营访问指标。

SQLite 一致性备份使用 `npm run db:backup:sqlite -- --output-dir <安全目录>`；生成的 manifest 可通过 `npm run db:restore:drill -- --manifest <manifest文件>` 执行隔离恢复校验。完整操作和安全边界见 `docs/operations/sqlite-backup-restore.md`。

当前 Prisma provider 为 SQLite，适合单实例首版部署；多实例或高并发上线前需要规划迁移到服务型数据库。

完整产品节奏与测试计划见：

- `docs/cloud-pet-product-plan.md`
- `docs/test-plan.md`
- `docs/qa-test-plan-and-cases.md`
