# 商家级宠物云养 + 商城系统 QA 测试计划与测试用例

## 1. 文档目的

本文档从高级软件测试工程师视角，为当前项目制定系统化测试计划、测试用例设计、自动化测试策略和维护方案。

当前项目不是普通 Demo，而是面向商家运营的系统。测试目标不是只证明接口能通，而是持续保障以下核心闭环可用：

```text
云养宠创建
→ 成长任务 / care score / 日记
→ 宠物主页 / 社区内容
→ 商品推荐 / 商城转化
→ 会员 / 优惠券 / 积分
→ 订单 / 支付 / 售后
→ 后台运营管理
```

当前阶段主线优先级：

1. 云养宠主线体验完整、稳定、可上线。
2. 商城相关能力保持现有回归，不主动扩大。
3. 后台运营能力保证核心闭环可观察、可补救。
4. 自动化测试以低成本、高价值、可长期维护为原则逐步补齐。

## 2. 当前自动化测试技术栈

### 2.1 已使用框架

| 层级 | 框架 / 工具 | 语言 | 主要用途 |
| --- | --- | --- | --- |
| 单元测试 | Jest | TypeScript | service 业务规则、工具函数、边界条件 |
| API Client 测试 | Jest | TypeScript | 前端 API client 请求契约 |
| API E2E 测试 | NestJS Testing + Supertest | TypeScript | 真实 HTTP API 链路测试 |
| UI E2E | Playwright | TypeScript | 真实浏览器登录、工作台、退出与关键用户路径 |
| 构建校验 | TypeScript Compiler / Next.js Build | TypeScript | 类型、路由、页面编译校验 |

### 2.2 后续增强方向

| 层级 | 工具 | 主要用途 |
| --- | --- | --- |
| 可视化回归 | Playwright Screenshot | 关键页面布局防回归 |
| 冒烟测试 | Playwright + API health check | 上线前快速验证主路径 |

`npm run test:e2e` 是 API E2E；`npm run test:ui` 是 Playwright 真实浏览器 UI E2E。

## 3. 测试目标

### 3.1 功能正确性

- 云养宠可以创建、同步会员、切换、成长、生成日记。
- 宠物主页可以编辑、访问、归档、记录访问次数。
- 社区可以发布、点赞、评论、关注、举报，后台可审核。
- 商城现有商品、购物车、订单、支付、退款链路不被破坏。
- 后台 admin session、权限、operation log、permission denied 正常。
- daily diary coverage/backfill 能准确定位缺口并补救。

### 3.2 数据一致性

- 成长任务不能重复完成。
- daily diary 不重复生成。
- backfill 不伪造成长任务完成。
- 支付确认幂等，不重复扣库存、不重复发积分、不重复写成功流水。
- 会员 session 与资源归属匹配。
- admin operation log 尽量绑定真实 staff。

### 3.3 安全与权限

- 未登录不能访问受保护 admin 页面/API。
- 会员 token 不能操作别人的资源。
- owner/operator 权限边界清晰。
- disabled staff 不可登录。
- 关键接口返回正确 401/403。

### 3.4 可用性

- 页面 loading/error/empty 状态可理解。
- 按钮点击后有反馈。
- 表单必填和错误提示清楚。
- 移动端布局不挤压、不遮挡。
- 用户侧成功后不只依赖本地状态，要重新确认后端状态。

## 4. 测试范围

### 4.1 本阶段重点范围：云养宠主线

| 模块 | 测试重点 |
| --- | --- |
| 会员同步工作台 | session 读取、会员 profile 加载、无登录引导 |
| 云养宠创建 | 创建后绑定会员、显示 active pet、写 localStorage |
| 宠物切换 | 多宠物切换、状态刷新、active pet 持久化 |
| 成长任务 | 任务完成、重复防护、会员归属校验、日记自动生成 |
| care score | care state 展示、成长等级、今日任务计数 |
| 宠物主页 | theme/headline/ownerStory 保存、主页访问、归档过滤 |
| 社区互动 | 发帖、点赞、评论、关注、举报、后台审核 |
| 后台运营 | daily diary coverage/backfill、operation log、权限 |

### 4.2 保持回归范围：商城/支付/售后

| 模块 | 回归重点 |
| --- | --- |
| 商品 | 列表、筛选、详情、推荐 |
| 购物车 | 添加、更新、库存不足 |
| 订单 | 创建、取消、状态查询 |
| 支付 | Payment Intent、confirm、ledger、幂等 |
| 售后 | 退款申请、审核、库存释放 |
| 会员营销 | 积分、优惠券、会员价 |

### 4.3 暂不纳入本阶段主动扩展

- 真实微信/支付宝 SDK。
- 真实公网 callback。
- 商品批量操作。
- 媒体上传。
- 复杂 campaign 营销中心。
- 自动对账、分账、财务报表。

## 5. 测试环境

### 5.1 本地开发环境

- OS：Windows
- Backend：NestJS
- Frontend：Next.js
- Test Runner：Jest
- API E2E：Supertest
- 默认 API prefix：`/api`
- 当前数据库：测试环境可使用 in-memory fallback；生产一致性后续需加强。

### 5.2 推荐测试数据原则

- 测试手机号使用独立号段，避免互相污染。
- 每个测试用例创建自己的订单、宠物、支付单。
- 对幂等测试保留同一资源重复请求。
- 对权限测试明确区分 owner/operator/member/anonymous。
- 不依赖测试执行顺序。

## 6. 测试策略

### 6.1 单元测试策略

适合测试：

- 成长任务规则。
- care score / care state 计算。
- daily diary 生成和 backfill 规则。
- payment intent 状态机。
- ledger 追加式记录。
- 优惠券叠加限制。
- 库存释放规则。

原则：

- 输入输出明确。
- 覆盖正常、异常、边界、重复请求。
- 不通过 UI 验证纯业务规则。

### 6.2 API Client 测试策略

适合测试：

- `web/app/member/member-api.ts`
- `web/app/cloud-pets/cloud-pets-api.ts`
- `web/app/admin/admin-api.ts`
- `web/app/shop/shop-api.ts`

重点验证：

- 请求 URL。
- method。
- headers。
- body。
- 错误消息解析。
- session token 是否正确传递。

### 6.3 API E2E 测试策略

适合测试：

- 登录/session。
- 权限 guard。
- controller + service + DTO 完整链路。
- 多模块副作用。
- operation log / permission denied。

原则：

- 用 Supertest 请求真实路由。
- 每条用例只验证一个关键业务目标。
- 对长链路保留少量高价值端到端测试，不滥用。

### 6.4 UI E2E 测试策略

建议新增 Playwright 后覆盖：

- 云养宠主线 smoke。
- admin 登录和 daily diary 操作。
- 支付主路径 smoke。
- 关键页面移动端截图。

原则：

- UI E2E 数量少但稳定。
- 只覆盖真实用户最核心路径。
- 避免测试实现细节和 CSS 类名。
- 优先通过可见文本、role、label 定位。

## 7. 测试用例设计

### 7.1 云养宠工作台

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-WK-001 | 未登录访问云养宠工作台 | 无 member session | 打开 `/cloud-pets` | 显示会员同步表单、创建宠物表单、空态提示 | UI E2E | P0 |
| CP-WK-002 | 会员同步成功 | 存在会员账号 | 输入称呼和手机号，点击同步 | 显示会员姓名、手机号、等级、积分 | UI E2E / API E2E | P0 |
| CP-WK-003 | 已有 session 自动恢复工作台 | localStorage 有 `kzt_member_session` | 打开 `/cloud-pets` | 自动加载 member profile 和宠物列表 | UI E2E | P0 |
| CP-WK-004 | 会员同步失败 | token 无效或接口失败 | 打开页面或点击同步 | 展示错误提示，不出现错误空白页 | UI E2E | P1 |
| CP-WK-005 | 刷新会员数据 | 已登录会员 | 点击“刷新” | 重新拉取会员 profile，页面数据更新 | UI E2E | P1 |
| CP-WK-006 | 切换会员 | 已登录会员 | 点击“切换” | 服务端撤销 session，清除本地 session，回到未登录工作台 | UI E2E / API E2E | P0 |
| CP-WK-007 | 临时同步故障恢复 | 有效 session，profile 首次返回 5xx | 点击“重新同步” | 保留 session 和 active pet，重试成功恢复工作台 | UI E2E | P0 |

### 7.2 云养宠创建

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-CRT-001 | 创建猫猫云养宠 | 有效 member session | 填写昵称、cat、性格并提交 | 返回 petNo，归属取自 session，页面展示宠物主页卡片 | API E2E / UI E2E | P0 |
| CP-CRT-002 | 创建狗狗云养宠 | 无或有会员 session | 填写 dog 类型宠物并提交 | 创建成功，species 为 dog | API E2E | P1 |
| CP-CRT-003 | 未同步时创建 | 未登录 | 填写会员身份和宠物资料后创建 | 前端先建立 session，再携带 token 创建并同步工作台 | UI E2E | P0 |
| CP-CRT-004 | 创建频率限制 | 同一有效 member session | 一小时内连续创建 6 只宠物 | 前 5 次成功，第 6 次返回 429 且不创建数据 | API E2E | P1 |
| CP-CRT-004 | 必填项缺失 | 无 | 清空昵称或手机号提交 | 表单阻止提交或接口返回校验错误 | UI E2E / API E2E | P1 |
| CP-CRT-005 | 创建后推荐入口可用 | 创建成功 | 查看商城联动区域 | 不报错；有推荐则展示推荐，无推荐则正常空态 | UI E2E | P2 |

### 7.3 宠物切换

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-SW-001 | 多宠物列表展示 | 会员有多只宠物 | 同步会员 | 显示多只宠物切换按钮 | UI E2E | P1 |
| CP-SW-002 | 切换 active pet | 会员有多只宠物 | 点击第二只宠物 | care score、成长等级、主页信息切换 | UI E2E | P1 |
| CP-SW-003 | active pet 持久化 | 已切换宠物 | 刷新页面 | 仍恢复上次 active pet | UI E2E | P1 |

### 7.4 成长任务与 care score

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-GR-001 | 完成成长任务成功 | 当前会员拥有宠物 | 点击“完成”成长任务 | 返回 completedTask，pet stats/growth 更新 | API E2E / UI E2E | P0 |
| CP-GR-002 | 完成任务携带 member token | 已登录会员 | 调用 `completeGrowthTask` | 请求带 `X-Member-Token` | API Client | P0 |
| CP-GR-003 | 非本人 token 不能完成任务 | A 的宠物，B 的 token | B 请求完成 A 的宠物任务 | 返回 403 | API E2E | P0 |
| CP-GR-004 | 重复完成同一天任务 | 已完成一次 | 再次完成同一任务 | 返回 409，不重复加成长值 | API E2E / Unit | P0 |
| CP-GR-005 | 完成任务自动生成当日日记 | 当天无日记 | 完成任务 | timeline 出现 `daily_diary` | API E2E | P0 |
| CP-GR-006 | care score 展示正确 | 宠物有成长数据 | 打开工作台 | 展示 care score 和 care state 文案 | UI E2E | P1 |
| CP-GR-007 | 下一步行动展示 | 完成任务成功 | 查看页面 | 展示主页、社区、商城等 nextActions | UI E2E | P1 |

### 7.5 Daily Diary 与 backfill

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-DD-001 | 完成任务自动生成当日日记 | 宠物当天无日记 | 完成成长任务 | 自动生成 daily diary | API E2E | P0 |
| CP-DD-002 | 当天已有日记不重复生成 | 宠物当天已有日记 | 完成任务或 backfill | 不重复写日记 | Unit / API E2E | P0 |
| CP-DD-003 | 查询 daily diary coverage | admin 已登录 | GET coverage | 返回 covered/missing/rate/missingPets | API E2E | P0 |
| CP-DD-004 | selected backfill | 存在缺失宠物 | 选择 petIds backfill | 只补选中的宠物 | API E2E | P0 |
| CP-DD-005 | missingOnly backfill | 存在缺失宠物 | missingOnly backfill | 补全部缺失宠物 | API E2E | P0 |
| CP-DD-006 | NO_TASK_COMPLETED fallback diary | 缺失原因是无任务完成 | backfill | 生成 presence diary，不修改任务/经验/奖励 | API E2E / Unit | P0 |
| CP-DD-007 | backfill operation log | admin session 登录 | 执行 backfill | operation log 记录 staffId/staffName/staffRole | API E2E | P1 |

### 7.6 宠物主页

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-HP-001 | 编辑主页配置 | 已有宠物 | 修改 theme/headline/ownerStory 保存 | 保存成功，profile 返回新配置 | API E2E / UI E2E | P0 |
| CP-HP-002 | 访问宠物主页 | 已有宠物 | 打开 `/cloud-pets/:petNo` | 页面展示宠物信息、成长档案 | UI E2E | P0 |
| CP-HP-003 | 主页访问计数 | 已有宠物 | 记录访问 | homepageVisitCount 增加 | API E2E | P1 |
| CP-HP-004 | 归档过滤 | 有 growth_task / daily_diary 事件 | 查询 archive?eventType=growth_task | 只返回对应类型 | API E2E | P1 |
| CP-HP-005 | 分享奖励展示 | 达到奖励条件 | 打开主页 archive | 返回 commerceReward unlocked | API E2E | P2 |
| CP-HP-006 | 不存在宠物主页 | 无对应 petNo | 打开公开分享链接 | 返回中文 HTTP 404，不发送访问上报 | UI E2E | P0 |
| CP-HP-007 | 非法归档筛选 | 已有宠物 | archive 使用未知值 | 安全回退“全部”，页面继续展示 | UI E2E | P1 |

### 7.7 社区互动

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| CP-CM-001 | 发布社区动态 | 已选择宠物 | 输入内容并发布 | 列表出现新动态 | API E2E / UI E2E | P0 |
| CP-CM-002 | 未选择宠物不能发布 | 无 active pet | 点击发布 | 页面提示先选择宠物 | UI E2E | P1 |
| CP-CM-003 | 点赞动态 | 已选择宠物 | 点击点赞 | likeCount 增加 | API E2E / UI E2E | P1 |
| CP-CM-004 | 评论动态 | 已选择宠物 | 点击评论 | commentCount 增加 | API E2E / UI E2E | P1 |
| CP-CM-005 | 关注宠物 | 已选择宠物 | 点击关注 | following 成功 | API E2E | P1 |
| CP-CM-006 | 举报动态 | 已选择宠物 | 点击举报 | report 进入 pending_review | API E2E | P1 |
| CP-CM-007 | 后台审核举报 | admin 已登录 | 审核 report | 状态更新，必要时隐藏帖子 | API E2E | P1 |
| CP-CM-008 | 处理并隐藏举报内容 | owner 已登录、举报待审核 | 点击“处理并隐藏帖子” | 帖子变 hidden、举报变 reviewed、公开主页不再展示 | UI E2E | P0 |

### 7.8 Admin 认证与权限

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| ADM-AUTH-001 | owner 登录成功 | seed owner | POST login | 返回 session，不返回 passwordHash | API E2E | P0 |
| ADM-AUTH-002 | 错误密码失败 | seed owner | 错误密码登录 | 返回 401 | API E2E | P0 |
| ADM-AUTH-003 | disabled staff 登录失败 | disabled staff | 登录 | 返回 403/401 | API E2E | P0 |
| ADM-AUTH-004 | 未登录访问 admin API | 无 session | 请求 protected API | 返回 401 | API E2E | P0 |
| ADM-AUTH-005 | operator 访问 owner-only | operator session | 请求 owner-only API | 返回 403，记录 permission denied | API E2E | P0 |
| ADM-AUTH-006 | logout 后 session 失效 | 已登录 | logout 后 me | me 返回 401 | API E2E | P0 |
| ADM-AUTH-007 | 未登录访问 admin 页面 | 无 session | 打开 `/admin/dashboard` | 跳转 `/admin/login` | UI E2E | P0 |

### 7.9 支付与 ledger 回归

| ID | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 自动化层级 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| PAY-001 | 创建 payment intent | pending order | POST `/api/payments/intents` | 金额来自订单，status pending | API E2E | P0 |
| PAY-002 | 非订单会员不能支付 | 他人 order | 创建/确认 intent | 返回 403 | API E2E | P0 |
| PAY-003 | confirm success | pending intent | confirm success | intent paid，order paid，ledger success | API E2E | P0 |
| PAY-004 | confirm failed | pending intent | confirm failed | intent failed，order 不变 paid | API E2E | P0 |
| PAY-005 | 重复 confirm 幂等 | paid intent | 再次 confirm success | 不重复 ledger，不重复副作用 | API E2E / Unit | P0 |
| PAY-006 | admin 查看 payment ledger | owner session | GET admin payments | 返回流水和详情 | API E2E | P1 |

## 8. 自动化测试维护规范

### 8.1 命名规范

- 单元测试文件：`*.service.spec.ts`、`*.mapper.spec.ts`
- 前端 API 测试文件：`*-api.spec.ts`
- API E2E：统一维护在 `test/app.e2e-spec.ts`，后续可按模块拆分
- UI E2E：建议 `e2e/cloud-pets.spec.ts`、`e2e/admin.spec.ts`

### 8.2 用例维护原则

- 新增功能必须至少补一类自动化测试。
- 权限、幂等、资金、库存相关改动必须补 API E2E。
- 页面主流程改动至少跑 `web:build`，上线前补 UI E2E。
- 修 bug 时先补复现测试，再修代码。
- 避免测试依赖执行顺序。
- 避免测试依赖真实时间，必要时封装时间或使用唯一数据。

### 8.3 测试数据维护

- 每条 e2e 用例使用独立手机号、订单号由系统生成。
- seed 账号集中维护，不硬编码到生产逻辑。
- admin owner/operator/disabled 三类账号必须长期保留。
- 会员测试 token 通过登录接口生成，不直接伪造。

### 8.4 flaky 测试处理

当测试偶发失败时，按以下顺序排查：

1. 是否依赖真实时间。
2. 是否依赖测试执行顺序。
3. 是否共享了 in-memory 状态。
4. 是否等待异步副作用不足。
5. 是否端口或环境变量污染。
6. 是否 UI selector 不稳定。

flaky 测试不允许长期跳过；如果必须临时跳过，需要在备注里写清原因和恢复条件。

## 9. 建议执行命令

### 9.1 日常小改动

```bash
cmd /c npm test -- <相关 spec 文件> --runInBand
cmd /c npm run web:build
```

### 9.2 后端接口/权限改动

```bash
cmd /c npm test -- <相关 service spec> --runInBand
cmd /c npm run test:e2e -- -t "<相关用例名>"
cmd /c npm run build
```

### 9.3 阶段完成回归

```bash
cmd /c npm test -- --runInBand
cmd /c npm run test:e2e -- --runInBand
cmd /c npm run build
cmd /c npm run web:build
```

### 9.4 后续 Playwright 建议命令

```bash
cmd /c npm run test:ui
cmd /c npm run test:ui -- cloud-pets
cmd /c npm run test:ui:headed
```

## 10. 缺陷管理流程

### 10.1 缺陷等级

| 等级 | 定义 | 示例 |
| --- | --- | --- |
| P0 | 阻塞核心业务或资金/权限严重错误 | 他人可支付订单、admin 未登录可操作、支付重复入账 |
| P1 | 核心流程不可用但有绕路 | 云养宠创建失败、成长任务失败、后台 backfill 失败 |
| P2 | 非核心功能异常或体验明显问题 | 社区点赞失败、页面空态不清楚 |
| P3 | 文案、样式、小兼容问题 | 按钮文案不统一、移动端轻微间距问题 |

### 10.2 缺陷记录字段

- 标题
- 环境
- 前置条件
- 复现步骤
- 实际结果
- 预期结果
- 截图/日志
- 影响范围
- 严重等级
- 关联测试用例
- 修复版本
- 回归结果

### 10.3 回归原则

- P0/P1 修复后必须补自动化测试。
- 权限、支付、库存类问题必须跑相关完整链路。
- UI 问题至少截图确认。

## 11. 上线准入标准

上线前必须满足：

- `npm test -- --runInBand` 通过。
- `npm run test:e2e -- --runInBand` 通过。
- `npm run build` 通过。
- `npm run web:build` 通过。
- 云养宠主线 smoke 通过。
- admin 登录和 daily diary backfill smoke 通过。
- 支付核心 smoke 通过。
- 无 P0/P1 未关闭缺陷。
- 已知 P2/P3 缺陷有明确影响说明和修复计划。

## 12. 当前项目测试现状结论

当前项目已经具备较好的 API 自动化基础：

- Jest 单元测试已覆盖多个 service 和前端 API client。
- Supertest API E2E 已覆盖订单、会员、云养宠、admin、支付 ledger 等关键链路。
- 构建命令可作为类型和路由的基础质量门。

当前主要不足：

- 页面级覆盖已建立，但关键页面的截图视觉回归仍需逐步补齐。
- in-memory fallback 与生产数据库一致性仍需继续收紧。
- 上线前仍需持续验证移动端布局、限流和生产重启恢复。

下一步建议：

1. 继续按云养宠用户主路径补充高风险页面场景。
2. 为公开主页和后台运营页增加少量稳定的视觉基线。
3. 每个小闭环先跑定向测试，阶段完成后跑完整自动化回归。
## 13. 最新阶段同步

- 成长任务接口现在强制要求会员 session。
- 无 X-Member-Token 完成成长任务返回 401。
- 他人会员 token 完成非本人宠物任务返回 403。
- 前端云养宠工作台和会员中心都改为带 session token 完成任务。

## 14. 最新阶段同步：宠物主页编辑权限

- 宠物主页编辑接口现在强制要求所属会员 session。
- 无 X-Member-Token 保存主页返回 401。
- 他人会员 token 保存非本人宠物主页返回 403。
- 前端云养宠工作台保存主页时会携带当前 member session。

## 15. 最新阶段同步：社区写操作会员身份

- 社区写操作现在强制要求会员 session。
- 发帖必须是宠物所属会员。
- 点赞、评论、关注、举报的 memberPhone/name 由 X-Member-Token 派生，不再信任前端 body。
- 未登录发帖返回 401，他人会员为非本人宠物发帖返回 403。

## 16. 最新阶段同步：会员会话与资料所有权

- member session 使用随机 token，生产环境持久化 `expiresAt` / `revokedAt`。
- session 可跨 API 进程重启恢复，logout 后旧 token 立即返回 401。
- 会员资料、地址和积分兑换必须携带当前 member session。
- 匿名访问敏感会员接口返回 401，跨会员手机号访问返回 403。
- `/member` 已移除“按手机号查询”，地址和积分操作统一走 `/members/me/*`。
- Playwright 覆盖页面登录、退出、本地 session 清理及后端 token 撤销。

## 17. 最新阶段同步：云养宠创建身份

- `POST /api/cloud-pets` 强制要求有效 member session，匿名请求返回 401。
- ownerName / ownerPhone 始终由服务端 session 覆盖，不能伪造宠物归属。
- 工作台未同步时必须先完成短信验证码挑战，不能再由姓名和手机号静默建立 session。
- 工作台“切换”调用服务端 logout，刷新后不会凭保存的姓名/手机号静默重新登录。
- API E2E 覆盖匿名 401、无效 token 401 和 session 身份覆盖；Playwright 覆盖退出撤销与刷新后不恢复。
- 同一 member session 每小时最多创建 5 只云养宠，第 6 次返回统一中文 429。

## 18. 最新阶段同步：公开主页访问防刷

- 公开主页由浏览器生成并保存匿名访客 ID，访问上报不再由 Next 服务端代发。
- 后端只保存匿名 ID 的 SHA-256 截断哈希，不保存原始 ID。
- 同一宠物、来源、匿名访客和日期只计一次；重复刷新返回成功但总数不增长。
- 不同访客或不同来源正常累计，缺失或非法 visitorId 返回 400。
- API E2E、Playwright 和生产重启冒烟均覆盖去重与持久化。

## 19. 最新阶段同步：公开资料隐私边界

- 公开宠物资料接口不返回会员姓名和手机号，自动生成简介不再包含主人姓名。
- 会员退出后立即清除当前宠物、推荐和私有照顾面板，刷新后也不能由本地宠物编号恢复。
- API E2E 覆盖公开字段投影，Playwright 覆盖公开页面身份隐藏和退出后的页面级权限收口。

## 20. 最新阶段同步：会员手机号真实验证

- 会员 session 只能由有效的短信验证码 challenge 创建，不再接受姓名和手机号直接登录。
- 验证码仅保存 HMAC 哈希，5 分钟过期、最多尝试 5 次、成功后单次消费；同一未消费手机号 challenge 受发送冷却保护。
- 开发和测试 adapter 返回测试码便于自动化，生产必须配置 HTTPS webhook，API 响应不返回验证码。
- 单元测试覆盖错误码、重复消费、冷却和数据库持久化；API E2E 与 Playwright 覆盖实际挑战登录；生产 smoke 覆盖 webhook 调用。

## 21. 最新阶段同步：代理限流与验证码运营指标

- 生产环境必须显式配置可信代理跳数；应用在路由和限流初始化前设置 Express `trust proxy`。
- 生产 smoke 验证同一转发 IP 超限返回 429，不同转发 IP 保持独立额度。
- Admin dashboard 展示近 24 小时验证码发送、成功、活跃、过期、锁定、错误尝试和成功率。
- 单元测试覆盖代理跳数配置和指标计算，API E2E 与 Playwright 覆盖后台指标返回及展示。

## 22. 最新阶段同步：多宠工作台可靠性

- 恢复有效会员 session 期间显示工作台 loading，不闪现未登录表单。
- 切换宠物时重置日记筛选、选中日期、编辑态和任务后续动作，并持久化最后选择。
- 推荐请求使用请求序号隔离，快速切换时较慢的旧响应不能覆盖当前宠物。
- 推荐区域包含 loading、empty、error 和 retry 状态，失败重试不丢失当前宠物。
- Playwright 覆盖 CP-SW-001/002/003、乱序响应和推荐失败恢复。

## 23. 最新阶段同步：后台日记补救页面

- Playwright 通过真实会员 session 创建当日日记缺口，再由 owner staff session 进入补救页。
- 页面用例覆盖缺口原因展示、单宠勾选、selected backfill、成功明细和补救后列表刷新。
- 复选框增加宠物名称可访问标签，关键加载、筛选、操作和结果区域提供稳定测试标识。
- Playwright 会员登录种子使用仅在 `NODE_ENV=test` 生效的独立客户端标识，避免并行用例共享匿名 IP 限额；生产环境仍只按 member session 或真实来源 IP 限流。

## 24. 最新阶段同步：后台单宠运营详情

- Playwright 创建包含今日照护、自动日记、主人手记、社区动态和主页访问的完整运营样本。
- owner 可按宠物编号和类型筛选唯一目标，并进入单宠运营详情。
- 页面级断言覆盖会员标识、近期日记、近期社区动态、主页访问和运营风险信号。
- 云养宠筛选按钮与列表项增加稳定测试标识，列表项同时暴露 `data-pet-no`。

## 25. 最新阶段同步：operator 云养宠只读权限

- operator 登录后仍可查看云养宠留存指标和成长任务数据。
- 所有成长任务“保存配置”按钮均保持禁用，照护分规则保存同样不可操作。
- 页面明确展示缺少 `cloud_pets:write` 权限；owner 的编辑能力不受影响。
- 后端 403 与 permission denied 日志继续由 API E2E 覆盖，前端只读状态由 Playwright 覆盖。

## 26. 最新阶段同步：公开主页异常状态

- 不存在的 petNo 使用路由级中文 404 页面，并返回真实 HTTP 404。
- 404 页面不挂载访问追踪器，不会向不存在的宠物发送访问上报。
- 未知 archive 参数统一回退到“全部”，筛选器保持明确选中状态。
- 成长归档、档案推荐和社区数据改为独立并行加载；可选模块失败时保留宠物主体并提示部分内容未加载。
- Playwright 覆盖中文 404、无访问上报、非法筛选回退和归档内容可见。

## 27. 最新阶段同步：社区举报联合处置

- 待审核举报新增“处理并隐藏帖子”，同时保留“仅标记已处理”和“驳回举报”。
- 联合动作先隐藏关联帖子，再更新举报状态；若第二步失败，页面明确提示帖子已隐藏、举报需重试。
- 已处理或已驳回的举报转为只读，展示中文状态、处理备注和处理时间。
- Playwright 验证帖子与举报两个 PATCH 均成功、处理按钮消失、后台帖子为 hidden，公开主页不再显示对应内容。

## 28. 最新阶段同步：会员工作台异常恢复

- `Invalid member session` 只清理失效 session 和 active pet，并向用户展示中文重新验证提示。
- profile 临时 5xx 不再注销有效会员；页面清除私有展示数据，但保留 session 与最后选择的宠物编号。
- 临时故障展示独立恢复卡，可原地重新同步，也可主动退出后重新登录。
- Playwright 覆盖无效 token 清理、本地存储清除、一次性 503、session 保留和重试后 active pet 恢复。

## 29. 最新阶段同步：社区关注流会员隔离

- 会员工作台同步成功后，关注流使用当前有效 member session 重新加载。
- 社区请求增加请求序号隔离，较慢的旧会员响应不能覆盖当前会员的数据。
- 退出或工作台同步失败时立即清空关注流并回到“全部”筛选；未登录时关注流入口保持禁用。
- Playwright 覆盖会员 A 的关注内容、退出清理、会员 B 同页登录及空关注流，证明个性化社区内容不会跨会员残留。

## 30. 最新阶段同步：重复关注统计幂等

- 关注接口增加 `created` 字段，首次关注返回 `true`，同一会员重复关注返回 `false`。
- 内存和 Prisma 数据库实现均保持关注记录唯一，重复请求不增加宠物关注者总数。
- 工作台只在 `created=true` 时增加会员关注互动统计，不再通过全站关注者数量猜测是否新关注。
- API E2E 覆盖首次与重复响应；Playwright 覆盖刷新页面后再次关注，关注者、会员关注数和互动总数均保持为 1。

## 31. 最新阶段同步：运行中会员会话失效

- 云养宠创建、成长任务、主人手记、主页编辑和社区写操作统一识别 `Invalid member session`。
- 运行中的会员 token 被撤销后，下一次受保护操作会立即清除本地 session、active pet、会员资料、推荐和个性化社区状态。
- 页面回到验证码登录入口并展示中文失效提示，不再保留无法操作的私有工作台。
- Playwright 使用真实服务端 logout 撤销已打开页面的 token，再触发点赞 401，验证私有面板和本地凭据均被清除；整份云养宠页面测试 12/12 通过。

## 32. 最新阶段同步：社区读取故障恢复

- 社区区域新增加载、错误和重新加载状态，首次加载期间不再误显示空社区。
- 临时 5xx 不会清空上一次成功加载的帖子、评论和关注流，用户仍可查看已有内容。
- 重试成功后错误提示消失并重新同步公开帖子、当前会员关注流和评论。
- Playwright 覆盖已加载帖子、刷新 503、旧内容保留和原地重试成功；整份云养宠页面测试 13/13 通过。

## 33. 最新阶段同步：生产 HTTP 安全基线

- Nest API 接入 Helmet，启用 `nosniff`、防嵌入、Referrer Policy、HSTS 等标准安全响应头，并移除 `X-Powered-By`。
- API 跨域资源策略显式设为 `cross-origin`，继续由单一 `WEB_ORIGIN` 控制浏览器 CORS 访问。
- Nest 启用 shutdown hooks，生产进程收到终止信号时执行框架与数据库资源清理生命周期。
- 生产 smoke 验证安全响应头、可信 CORS origin、恶意 origin 不被允许、请求 ID 透传，并继续覆盖迁移、启动、重启和 session 持久化。
- 生产依赖升级到 Next 16.2.11、Nest Express 11.1.28，并将 Sharp 固定到已修复版本；npm 官方 registry 的 `--omit=dev` 审计结果为 0 vulnerabilities。
- 依赖升级后全量验证：133/133 单测、84/84 API E2E、20/20 Playwright、后端构建、Next 生产构建和生产 smoke 全部通过。

## 34. 最新阶段同步：公开宠物主页视觉回归基线

- 独立 Playwright 视觉测试覆盖有效 `/cloud-pets/:petNo` 公开主页，不与已有工作台、404 或后台功能 smoke 重复。
- 基线使用桌面 Chrome 与 390x844 移动端视口，截图范围限定为公开宠物主页主体。
- 每个场景通过真实会员验证和云养宠 API 创建全新宠物，并关闭成长归档与商城推荐，保持第一版视觉样本聚焦且稳定。
- 动态宠物编号、分享 URL 和访问次数使用统一遮罩；本地宠物图片加载完成后才执行截图断言。
- 404 视觉快照本轮明确排除，继续由现有真实 HTTP 404、中文空态和无访问上报功能测试负责。
- 基线生成后连续两次定向复跑通过，原有云养宠页面回归 13/13 通过；节点全量门禁为 133/133 单测、84/84 API E2E、22/22 Playwright、后端构建和 Next 生产构建全部通过。

## 35. 最新阶段同步：SQLite 备份与隔离恢复

- 活动数据库通过 Prisma `VACUUM INTO` 创建一致性快照，不直接复制可能处于 WAL 写入中的源文件。
- 备份 manifest 仅保存文件 SHA-256、migration 指纹和 16 个云养宠核心数据域的 `count + hash`，不保存手机号、姓名、正文、token、密码哈希或数据库绝对路径。
- 恢复演练只读取同目录 manifest/backup 文件对，并在系统临时目录校验 `quick_check`、migration 和领域指纹，绝不覆盖当前源数据库。
- Jest 覆盖相对/绝对路径、内存库拒绝、SQL 字符串转义、稳定哈希、空表恢复，以及 SHA、SQLite 完整性、migration、domain 四类失败契约。
- 独立 recovery smoke 会预创建空库、执行真实 migrations、写入代表性数据、生成两个唯一备份、修改源库并重复恢复，证明恢复的是备份时快照。
- 节点最终门禁：151/151 单测、84/84 API E2E、22/22 Playwright、后端构建、Next 生产构建、production smoke 全部通过；recovery smoke 连续三次通过且无临时备份残留。
