# HTTP 请求体边界

生产 API 对 `application/json` 和 `application/x-www-form-urlencoded` 请求体使用统一的字节上限。

## 配置

```text
API_BODY_LIMIT_BYTES=102400
```

- 未配置时默认为 `102400` 字节（100 KiB）。
- 允许范围为 `16384` 到 `1048576` 字节。
- 只接受十进制整数，不接受 `100kb`、`1mb` 等带单位写法。
- 超出范围或格式错误会在生产启动阶段失败。
- `multipart/form-data`、文件上传、WebSocket 和网关层限制不属于本版本。

## 超限响应

超限请求在进入 Controller 前被拒绝，返回 HTTP 413：

```json
{
  "statusCode": 413,
  "message": "请求内容过大",
  "error": "Payload Too Large",
  "code": "PAYLOAD_TOO_LARGE"
}
```

响应会带 `X-Request-Id`，但不会记录请求正文。请求体过大不会改变 API 的 liveness/readiness 状态。

## 排障

1. 检查部署环境中的 `API_BODY_LIMIT_BYTES` 是否为整数且在允许范围内。
2. 根据响应头 `X-Request-Id` 关联网关和 API 日志。
3. 确认客户端使用的是 JSON 或 URL-encoded 请求，而不是本版本未覆盖的 multipart 上传。
4. 若合法业务请求接近上限，先统计真实 payload 大小，再调整配置并重启 API。
