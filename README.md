# Pet Toy Shop API

国内宠物玩具独立站的后端骨架，当前基于 NestJS + TypeScript。

## 已包含

- `GET /api/health`：服务健康检查
- `GET /api/products`：商品列表骨架
- `GET /api/products/:slug`：商品详情，包含 SKU、库存和商品图
- `POST /api/cart/items`：加入购物车；未传 `cartId` 时创建匿名购物车
- `GET /api/cart/:cartId`：查看购物车
- `PATCH /api/cart/items/:skuCode`：修改购物车商品数量
- `POST /api/cart/:cartId/checkout`：将购物车结算为待支付订单，成功后清空购物车
- `POST /api/orders`：创建待支付订单，包含库存校验
- `GET /api/orders/:orderNo`：查询订单状态
- `POST /api/payments/wechat`：创建微信 mock 支付单
- `POST /api/payments/alipay`：创建支付宝 mock 支付单
- `POST /api/payments/wechat/notify`：微信 mock 支付回调
- `POST /api/payments/alipay/notify`：支付宝 mock 支付回调
- `GET /api/admin/products`：后台商品列表，需要 `X-Admin-Token`
- `GET /api/admin/orders`：后台订单列表，需要 `X-Admin-Token`
- `PATCH /api/admin/orders/:orderNo/status`：后台修改订单状态，需要 `X-Admin-Token`
- `prisma/schema.prisma`：独立站核心数据模型，按 MySQL/Prisma 设计
- `GET /api/health` 会返回数据库配置状态
- Jest E2E 测试和 TypeScript 构建脚本

## 本地命令

```bash
npm install
npm run test:e2e
npm run build
npm run web:build
npm run prisma:validate
npm run prisma:generate
npm run api:dev
npm run web:dev
```

当前 Windows 环境里脚本会优先使用 `C:\Program Files\nodejs` 下的 Node.js，避免 Codex 内置 `node.exe` 抢占 PATH。

## 前端预览

本地开发时启动两个服务：

```bash
npm run api:dev
npm run web:dev
```

- API: `http://localhost:3000/api`
- Web: `http://localhost:3001`

前端默认读取 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api`，后台演示 token 默认是 `dev-admin-key`。

## 数据库配置

复制 `.env.example` 中的变量并配置真实 MySQL：

```text
DATABASE_URL="mysql://shop_user:shop_password@localhost:3306/pet_toy_shop"
ADMIN_API_KEY="replace-with-a-long-random-admin-token"
```

Prisma 当前固定在 6.x 版本，原因是 Prisma 7 改用了新的 `prisma.config.ts` 和 adapter 配置方式；这个项目先使用传统 `DATABASE_URL` 模式，方便和 NestJS CommonJS 骨架稳定集成。

本轮已经接入 Prisma 模块和 MySQL schema，但业务接口仍使用内存仓储。下一步可以逐个把商品、购物车、订单、支付服务替换到 Prisma 查询。

## 后台鉴权

后台接口使用 `X-Admin-Token` 请求头。开发默认值是：

```text
dev-admin-key
```

生产环境请设置 `ADMIN_API_KEY`，不要使用默认值。

## 购物车示例

```json
{
  "skuCode": "DBR-GREEN-M",
  "quantity": 1
}
```

已有购物车继续加购时传入 `cartId`：

```json
{
  "cartId": "cart_000001",
  "skuCode": "DBR-GREEN-M",
  "quantity": 1
}
```

## 购物车结算示例

```json
{
  "customer": {
    "name": "Demo Customer",
    "phone": "13800138000"
  },
  "address": {
    "receiverName": "Demo Customer",
    "phone": "13800138000",
    "province": "Guangdong",
    "city": "Shenzhen",
    "district": "Nanshan",
    "detail": "Science Park 1"
  }
}
```

请求：`POST /api/cart/cart_000001/checkout`

## 创建订单示例

```json
{
  "customer": {
    "name": "Demo Customer",
    "phone": "13800138000"
  },
  "address": {
    "receiverName": "Demo Customer",
    "phone": "13800138000",
    "province": "Guangdong",
    "city": "Shenzhen",
    "district": "Nanshan",
    "detail": "Science Park 1"
  },
  "items": [
    {
      "skuCode": "DBR-GREEN-M",
      "quantity": 2
    }
  ]
}
```

## 创建支付示例

```json
{
  "orderNo": "KZT20260511213045",
  "channel": "h5"
}
```

当前支付接口是 mock 实现，用来打通订单状态流。真实接入微信/支付宝时，可以保留接口形状，替换 `PaymentsService` 内部的支付网关调用。

支付回调示例：

```json
{
  "paymentNo": "PAY202605112130450001",
  "providerTradeNo": "wx_trade_001",
  "paidAmountCents": 3990
}
```

## 修改订单状态示例

```json
{
  "status": "shipped"
}
```

当前支持：`pending_payment`、`paid`、`shipped`、`completed`、`cancelled`。

## 后续建议

下一步可以接入真实数据库访问层，并继续补：

- Prisma 仓储实现，替换当前内存数据
- 真实微信/支付宝 SDK 与签名验签
- 后台登录账号体系和操作日志
