# 自动化测试计划

## 1. 当前自动化测试框架

当前项目的自动化测试主要使用 TypeScript / JavaScript 编写，框架分为三层。

### 1.1 Jest

用途：单元测试、service 逻辑测试、前端 API client 契约测试。

典型文件：

- `src/cloud-pets/cloud-pets.service.spec.ts`
- `src/members/members.service.spec.ts`
- `src/payments/payments.service.spec.ts`
- `web/app/member/member-api.spec.ts`
- `web/app/cloud-pets/cloud-pets-api.spec.ts`
- `web/app/admin/admin-api.spec.ts`

覆盖重点：

- service 业务规则
- API client 请求路径、method、headers、body
- 幂等、防重复、权限判断
- 边界条件和错误返回

### 1.2 NestJS Testing + Supertest

用途：后端 API 端到端测试。

典型文件：

- `test/app.e2e-spec.ts`

执行方式：

- 通过 NestJS Testing 创建测试应用
- 设置全局 `/api` prefix
- 使用 Supertest 自动发起 HTTP 请求
- 验证真实 controller、service、guard、DTO、异常处理链路

覆盖重点：

- API 路由是否存在
- 登录/session 是否生效
- 权限不足是否返回 401/403
- 订单、支付、云养宠、后台运营等完整接口流程
- 业务副作用是否正确发生

### 1.3 TypeScript / Next.js Build 校验

用途：构建级自动验证。

命令：

- `npm run build`
- `npm run web:build`

覆盖重点：

- 后端 TypeScript 编译
- Next.js 页面编译
- 前端类型检查
- 路由是否能正常生成
- 组件 import / props / API 类型是否一致

## 2. 真实浏览器测试框架

项目已经引入 Playwright，并通过 `npm run test:ui` 执行真实 Chromium 页面测试。`npm run test:e2e` 仍专指 NestJS + Supertest 的 API E2E，两套测试职责分开。

Playwright 的匿名会员认证种子通过 `X-Test-Client-Id` 隔离限流计数。该标识只在 `NODE_ENV=test` 生效；生产环境忽略它，继续按 member session 或来源 IP 限流。

当前 Playwright 已覆盖：

- 打开 `/cloud-pets`
- 同步会员
- 创建云养宠
- 点击完成成长任务
- 查看 care score / 今日任务变化
- 编辑宠物主页
- 发布、点赞、评论、关注和举报社区动态
- 后台举报处理并隐藏关联帖子，公开主页同步下线
- 访问公开宠物主页
- 公开主页中文 404、无效归档参数回退和无效访问上报防护
- 后台登录、退出和未登录页面拦截
- operator 云养宠配置只读权限
- 后台社区举报筛选
- 后台日记缺口查看、选中补救和结果刷新
- 后台云养宠筛选、单宠运营详情和跨模块信号核对
- 移动端云养宠主流程
- 多宠物切换、宠物作用域状态重置和 active pet 刷新恢复
- 会员工作台恢复遮罩、推荐请求竞态防护和失败重试
- 会员 session 失效清理与临时 profile 故障原地重试

## 3. 测试分层策略

### 3.1 单元测试

目标：验证纯业务规则和工具函数，不依赖完整 HTTP 链路。

适合模块：

- 云养宠成长规则
- daily diary 生成规则
- care score / care state 计算
- 支付 intent / ledger 幂等规则
- 优惠券、积分、库存规则

### 3.2 API Client 测试

目标：验证前端调用后端的契约不变。

适合模块：

- member API
- cloud pets API
- admin API
- shop/payment API

重点检查：

- URL 是否正确
- method 是否正确
- headers 是否正确
- request body 是否正确
- response 类型是否符合页面使用预期

### 3.3 API E2E 测试

目标：验证完整后端链路。

适合模块：

- 登录/session
- 创建云养宠
- 完成成长任务
- daily diary 自动生成
- 后台 daily diary coverage/backfill
- 支付 intent / confirm / ledger
- admin 权限

### 3.4 UI E2E 测试

目标：验证真实浏览器页面可用。

当前框架：Playwright。

原因：

- 支持 Chromium/WebKit/Firefox
- 适合 Next.js 应用
- 能自动点击、输入、等待接口、断言页面文本
- 能截图，方便检查 UI 回归

## 4. 云养宠主线测试计划

### 4.1 会员同步工作台

用例：未登录访问 `/cloud-pets`。

预期：

- 页面显示会员同步入口
- 可输入会员称呼和手机号
- 同步成功后显示会员信息
- 如果会员已有宠物，显示宠物切换区
- 如果会员没有宠物，显示创建引导

自动化覆盖建议：

- API client：`getCurrentMemberProfile` 带 `X-Member-Token`
- UI E2E：输入手机号后能看到会员卡片

### 4.2 创建云养宠

用例：会员创建第一只云养宠。

预期：

- 创建成功
- 自动绑定当前会员 session
- 工作台展示新宠物
- 宠物主页区域展示头像、成长值、care score、时间线
- localStorage 写入 `kzt_active_cloud_pet`

自动化覆盖建议：

- API E2E：`POST /api/cloud-pets`
- UI E2E：填写表单并点击生成，页面出现宠物名

### 4.3 宠物切换

用例：一个会员有多只宠物。

预期：

- 页面显示多只宠物
- 点击不同宠物后，care score、成长等级、主页信息切换
- active pet 写入 localStorage
- 日记筛选、编辑态和任务后续动作切回当前宠物作用域
- 较早发出的推荐请求不能覆盖后来选择的宠物
- 刷新后恢复最后选择的宠物

自动化覆盖建议：

- API E2E：会员 profile 返回多只 pets
- UI E2E：点击宠物切换按钮后检查页面信息变化

### 4.4 成长任务完成

用例：会员完成当前宠物的成长任务。

预期：

- 前端请求带 `X-Member-Token`
- 只有宠物所属会员可以完成任务
- 完成后更新 stats / growth
- 当天没有日记时自动生成 daily diary
- 不重复完成同一天同一任务

当前已覆盖：

- `web/app/member/member-api.spec.ts`：完成任务时可携带 member session token
- `test/app.e2e-spec.ts`：别的会员 token 不能完成非本人宠物任务
- 既有 e2e：重复完成同一天任务返回 409

### 4.5 宠物主页编辑

用例：编辑 theme、headline、ownerStory、模块开关。

预期：

- 保存成功
- 页面展示更新后的主页配置
- 独立宠物主页 `/cloud-pets/:petNo` 可访问
- 分享页访问计数正常记录

自动化覆盖建议：

- API client：`updateCloudPetHomepage`
- API E2E：更新 homepage 后读取 pet profile
- UI E2E：编辑表单并检查保存后文本

### 4.6 社区互动

用例：宠物发布社区动态，点赞、评论、关注、举报。

预期：

- 未选择宠物不能发布/互动
- 发布后社区列表刷新
- 点赞、评论、关注、举报接口可用
- 举报进入后台审核队列

自动化覆盖建议：

- API E2E：社区 post / like / comment / follow / report
- UI E2E：发布动态后列表出现新内容

### 4.7 Daily Diary 运营闭环

用例：后台查看当日日记覆盖缺口并 backfill。

预期：

- 未登录 admin 不能访问
- owner/operator 按权限访问
- 缺失宠物列表准确
- selected / missingOnly backfill 正确
- operation log 绑定真实 staff

当前已覆盖：

- admin session 相关测试
- daily diary coverage/backfill API 测试
- 前端 admin API 测试

## 5. 商城暂缓后的测试边界

当前开发主线切到云养宠，商城测试暂时保持现有覆盖，不主动扩大。

仍需保留的回归范围：

- 订单创建不被破坏
- 支付 intent / ledger 不被破坏
- 商品推荐接口不被破坏
- 云养宠商城推荐入口不报错

## 6. 每轮开发建议执行命令

### 6.1 小改动

适用：只改一个 API client、一个 service 或一个页面小逻辑。

建议执行：

```bash
cmd /c npm test -- <相关 spec 文件> --runInBand
cmd /c npm run web:build
```

### 6.2 后端接口或权限改动

建议执行：

```bash
cmd /c npm test -- <相关 service spec> --runInBand
cmd /c npm run test:e2e -- -t "<相关用例名>"
cmd /c npm run build
```

### 6.3 前端页面主流程改动

建议执行：

```bash
cmd /c npm test -- <相关 api client spec> --runInBand
cmd /c npm run web:build
```

页面主流程改动追加：

```bash
cmd /c npm run test:ui -- cloud-pets
```

### 6.4 阶段完成 / 准备提交

建议执行完整回归：

```bash
cmd /c npm test -- --runInBand
cmd /c npm run test:e2e -- --runInBand
cmd /c npm run build
cmd /c npm run web:build
```

## 7. 阶段一当前验收清单

阶段一：Cloud Pet Workspace。

已完成：

- `/cloud-pets` 变成会员绑定工作台
- 读取 `kzt_member_session`
- 可同步会员 profile
- 显示会员信息
- 显示宠物切换
- 显示 care score / 成长等级 / 今日任务
- 可完成成长任务
- 完成成长任务时前端携带 member token
- 后端收到 member token 时校验宠物归属
- 非本人 token 完成任务返回 403
- 支持刷新会员数据
- 支持切换会员
- 恢复有效会员 session 时显示 loading，避免闪现登录表单
- 多宠物切换会同步今日照顾、日记、主页和推荐
- 推荐请求支持加载、失败、空态和原地重试
- 乱序推荐响应不会覆盖当前宠物

已验证：

- `cmd /c npm test -- web/app/member/member-api.spec.ts --runInBand`
- `cmd /c npm run build`
- `cmd /c npm run test:e2e -- -t "rejects member-token growth task"`
- `cmd /c npm run web:build`
- `cmd /c npm run test:ui`

本轮新增页面级验证：

- 两只宠物的列表、切换、日记筛选重置和照顾状态隔离
- active pet 写入 localStorage，并在刷新后恢复
- 推荐接口乱序时保留最后选择的宠物
- 推荐失败后可重试，且不丢失当前宠物

## 8. 上线前建议补充

上线前仍需补充：

- 支付核心 UI smoke test
- 构建产物检查
- 数据库模式专项回归
- 其他关键接口的 401/403/429 权限回归

已完成：

- 生产环境变量启动校验及默认凭据拦截
- 会员短信验证码 challenge、HMAC 哈希、有效期、尝试次数、单次消费、发送冷却和生产 webhook adapter
- 会员中心与云养宠工作台验证码登录 Playwright，以及生产响应不返回测试码的 smoke
- 显式 `TRUST_PROXY_HOPS`、代理客户端 IP 独立限流和后台 24 小时验证码漏斗
- member session 随机 token、过期、数据库持久化、跨重启恢复与 logout 撤销
- 会员资料、地址和积分兑换的匿名 401、跨会员 403 与页面退出回归
- 云养宠创建强制 member session、服务端归属覆盖，以及工作台切换后的服务端撤销
- 云养宠创建按 member session 每小时 5 次限流及 429 回归
- 公开宠物主页按匿名访客每日去重、原始 ID 不落库及数据库重启持久化
- 社区写操作按会员 session 限流与 429 回归
- 云养宠成长任务模板与 care score 规则的数据库持久化、重启恢复和空库迁移验证
- liveness/readiness 健康探针及数据库不可用时的 503 回归
- 请求关联 ID、查询参数脱敏日志和 5xx 错误级别回归
- 隔离 SQLite 的生产构建 smoke：迁移、readiness、owner 登录、进程重启及运营配置恢复
- 构建前清理陈旧 `dist`，并验证生产入口为当前 `dist/main.js`
- 迁移后数据库与 Prisma schema 的 drift 检查，以及 Payment Intent / Ledger 补偿迁移
- 生产 staff/session 持久化、scrypt 哈希、跨重启恢复、过期、disabled staff 与 logout 撤销
- 公开云养宠资料不返回会员姓名和手机号，自动简介不嵌入主人姓名
- 会员退出后立即清除当前宠物、推荐和今日照顾区域，刷新后不能从本地宠物编号恢复私有工作台
- SQLite 一致性备份、隐私安全 manifest、隔离恢复演练，以及 SHA/完整性/migration/领域指纹失败回归
