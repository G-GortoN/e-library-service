# 后端

[English](README.md) | 简体中文

使用 Java 21、Spring Boot 4、Spring MVC/Security、JPA、PostgreSQL、Flyway 和 OpenAPI。后端源码包含书目、账号生命周期、借阅、预约、通知、后台管理和演示记账。运行验证状态见项目发布记录与 CI；存在源码不代表已经成功部署。

## 本地运行

安装 Java 21，启动专用 PostgreSQL 17 数据库，在本目录执行：

```sh
export DATABASE_URL=jdbc:postgresql://localhost:5432/elibrary
export DATABASE_USERNAME=elibrary
export DATABASE_PASSWORD='your-local-database-password'
export SPRING_PROFILES_ACTIVE=local
./mvnw spring-boot:run
```

服务监听 8080。`local` 配置允许 HTTP Cookie，初始化合成样例数据，并向本地 1025 端口 SMTP 捕获服务投递邮件。请自行设置管理员凭据，再通过管理工作台创建本地读者账号。开发夹具仅用于隔离环境。只有 `local` 或 `demo` 配置允许初始化样例数据，普通生产启动不创建。

管理员初始化需在启动前**同时**设置 `APP_ADMIN_EMAIL` 和 `APP_ADMIN_PASSWORD`，不提供默认管理员密码，重启不重置已有管理员凭据。生产环境必须使用 HTTPS，并配置 `APP_COOKIE_SECURE=true`。

## API 与配置

- OpenAPI JSON：`/api/openapi`；Swagger UI：`/api/docs`。
- 健康检查：`/actuator/health` 或 `/api/v1/health`。
- 转发头由 Tomcat 原生处理，采用默认内部与回环代理信任范围。API 仅位于容器内网，Caddy 应覆盖不可信转发头；扩展信任前验证 Funnel 代理链，不能无条件信任客户端 `X-Forwarded-For`。
- 先请求 `GET /api/v1/auth/csrf`，写操作使用响应 `headerName` 指定的请求头携带 `token`；登录退出后重新获取。登录接受 JSON `{email,password}`。Cookie 保存会话，服务端检查角色与账号状态。
- `APP_PUBLIC_BASE_URL` 是验证与密码恢复链接使用的可信前端地址。可选 `APP_PUBLIC_BACKUP_BASE_URL` 默认为空；配置为不同地址时，验证与恢复邮件会同时附上使用同一一次性令牌的备用链接，让不支持 IPv6 的收件人可通过 Funnel 入口操作。两个地址都必须为无凭据、查询参数和片段的完整 HTTP(S) URL，均不从请求头推导。任一链接使用成功后，两条链接的令牌都会失效。
- 对已存在、尚未验证且已启用的邮箱重复注册时，撤销旧验证链接，改发密码恢复邮件。邮箱持有人必须在恢复页面选择新密码，不会静默激活预注册旧密码或重复表单中的密码；禁用账号不收到新的设置令牌。不同账号状态的注册响应保持统一。
- `APP_MAIL_ENABLED=true` 以及 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_AUTH`、`SMTP_STARTTLS`、`APP_MAIL_FROM` 配置邮件投递。未配置邮件时注册和密码恢复返回 503，不虚报已投递；SMTP 故障不导致书目服务健康检查失败。
- `APP_MEDIA_DIRECTORY` 指定封面持久化目录。封面支持不超过 5 MB、单边不超过 4096 像素的 PNG/JPEG，重新编码后存储。CSV 导入支持 UTF-8、不超过 1 MB 和 200 行，必要表头为 `title,author,category`，可选 `isbn,description`。先预览错误，再整体导入；不进行部分成功导入。
- 借阅规则通过 `APP_LOAN_DAYS`、`APP_MAX_ACTIVE_LOANS`、`APP_RENEWAL_DAYS`、`APP_MAX_RENEWALS`、`APP_RESERVATION_HOURS`、`APP_FINE_RATE_MINOR` 和 `APP_FINE_CAP_MINOR` 配置。

## 事务与定时任务

Flyway 管理数据库结构，Hibernate 验证结构。部分唯一索引防止同一本书同时产生多个有效借阅。JPA 读取书目聚合，JDBC 投影一次查询带回实时可借状态，避免逐本查询；事务 SQL 明确表达生命周期更新。

所有领域写操作获取同一个 PostgreSQL 事务级 advisory lock。该设计有意在多个应用进程之间串行写入，简化借阅限额、FIFO 预约、上下架和最后一位有效管理员等联合约束。在小型 NAS 部署中优先保障正确性，牺牲高写吞吐；更大规模可改为按固定顺序锁定聚合，仍保留数据库约束与集成测试。

预约过期与到期提醒每分钟处理，持久化邮件队列每 15 秒处理。通知按业务事件去重；SMTP 使用有上限的指数退避重试，五次失败后保留失败记录。令牌邮件发送成功后清除正文，过期令牌正文一天后清理。如果进程在发送成功后、数据库提交前退出，SMTP 无法保证严格只投递一次。

逾期金额按完整 24 小时、整数最小货币单位计算并封顶，归还后冻结。减免与演示结清必须先归还图书，不处理真实付款。

## 验证

```sh
./mvnw verify
```

默认测试使用 Testcontainers 启动 PostgreSQL 17，需要兼容 Docker 的运行时。也可设置 `ELIB_TEST_DATABASE_URL`、`ELIB_TEST_DATABASE_USERNAME`、`ELIB_TEST_DATABASE_PASSWORD` 使用已有的**可丢弃测试数据库**。测试会清空所有应用表，不能指向真实图书馆数据库。测试使用可调整时钟，覆盖 HTTP 认证与 CSRF、并发借阅、排队优先权、续借与限额、下架、停用会话、令牌重放、罚金和邮件重试。

详见[实施计划](../docs/implementation-plan.zh-CN.md)与[部署指南](../deploy/README.zh-CN.md)。
