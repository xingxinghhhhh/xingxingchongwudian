# 首个后台 Owner 初始化

生产数据库完成迁移后，首次启动后台前必须创建一个真实的 Owner Staff。初始化使用独立运维命令，不提供公网 HTTP 初始化接口，也不会创建登录 session。

## 操作顺序

1. 准备生产数据库配置 `DATABASE_URL`。一次性 bootstrap 命令额外需要 `ADMIN_OWNER_NAME`、`ADMIN_OWNER_EMAIL`、`ADMIN_OWNER_PASSWORD`；这些凭据只用于初始化阶段。
2. 在已经完成 `npm run build` 的发布目录执行：

```bash
npm run ops:bootstrap:admin-owner
```

`ADMIN_OWNER_NAME`, `ADMIN_OWNER_EMAIL`, and `ADMIN_OWNER_PASSWORD` are
bootstrap-only inputs. They are required for this one-time command, but the
long-running API does not require the owner email or password after an active
Owner Staff exists in the database.

3. 使用同一 Owner 邮箱和密码访问 `/admin/login`，通过正常 Admin 登录流程建立 StaffSession。
4. 之后启动 API。生产启动只校验存在 active Owner，不会再用环境变量覆盖账号资料或密码。

## 安全行为

- 命令只允许在不存在任何 Owner Staff 的数据库中成功一次。
- 已有 Owner、Staff 编号冲突、邮箱冲突或输入校验失败都会非零退出。
- 密码只写入 salted scrypt hash；命令输出不包含密码。
- 不要把密码作为命令行参数传入，避免出现在进程列表或 shell 历史中。
- 该命令不是 Staff CRUD，也不是长期提权入口；后续 Staff 管理继续使用现有后台权限体系。

## 发布验证

空库接管路径应至少验证：bootstrap 成功、重复 bootstrap 失败、Owner 能登录。完整云养宠上线候选验证使用：

```bash
npm run verify:cloud-pet-launch
```
