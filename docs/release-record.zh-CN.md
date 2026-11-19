# 应用与容器交付验证

[English](release-record.md) | 简体中文

本记录关联公开源码、CI 验证和不可变容器产物。具体环境的访问方式及私有运维记录单独维护。验收范围和待完成项见[部署验证](nas-validation.zh-CN.md)。

为移除私人部署文档，源码历史已重新整理。下列源码链接指向对应的脱敏提交，其应用文件与原构建源码完全一致；既有 CI 记录和不可变镜像标签仍保留构建时的标识。

## 公开证据

| 证据 | 引用 |
| --- | --- |
| API/应用的等效脱敏源码 | [d9d0529d2edbb81cb1f78aaa713b2d7b02812b9d](https://github.com/G-GortoN/e-library-service/commit/d9d0529d2edbb81cb1f78aaa713b2d7b02812b9d) |
| 原始完整工作流 | [Verify and publish — 成功](https://github.com/G-GortoN/e-library-service/actions/runs/44156418893) |
| 双语 UI 的等效脱敏源码 | [8e5bb2234ae0b4952f8d7d011880b1ee83c417d3](https://github.com/G-GortoN/e-library-service/commit/8e5bb2234ae0b4952f8d7d011880b1ee83c417d3) |
| 双语完整工作流 | [CI 44436983590 — 成功](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) |
| 目标平台 | `linux/amd64` |
| 发布 | GHCR；两类应用镜像均已验证可匿名读取 manifest |

## 已验证产物引用

以下组合已有部署验证证据：与 `d9d0529` 对应的 API、与 `8e5bb22` 对应的双语 Web，以及固定的 PostgreSQL 镜像。这些是产物引用，不是部署环境的私有配置；其他环境参数应在本地填写。

```dotenv
API_IMAGE=ghcr.io/g-gorton/e-library-service-api@sha256:0a424f5ffcab40ae11d7560838be4a9cc027cf7590c0be8c83fa537439b40839
WEB_IMAGE=ghcr.io/g-gorton/e-library-service-web@sha256:378ac104ddda21b7ffccd55fe5359343e3b2beff8dd237385ee5dd4b7c3c53b4
DB_IMAGE=public.ecr.aws/docker/library/postgres@sha256:005c5c37db96c1e6652a79ea31f9886402fba81ac95dc2db897739121dd7f8f2
```

PostgreSQL 的 `linux/amd64` manifest 已确认在 Docker Hub 与 Docker 官方 ECR Public 发布源之间一致。更改镜像下载源不会修改数据库内容或应用代码。

源码标签使用 `sha-<完整提交 SHA>`。工作流的 `image-reference-api`、`image-reference-web` 产物保留已发布镜像摘要。工作流成功并发布新镜像，不会自动修改单独固定版本的部署；每个选用产物均应验证后明确升级。

## 已验证行为

| 检查 | 结果 |
| --- | --- |
| 后端 | 16 项测试通过，无失败、错误或跳过：15 项真实 HTTP/PostgreSQL 集成测试及 1 项限流单元测试 |
| 数据库测试环境 | 本地专用 PostgreSQL；CI 使用 Docker/Testcontainers 2.0.5 与 PostgreSQL 17 |
| 前端 | 7 项测试、TypeScript 检查及生产构建通过 |
| 本地双语浏览器 | 320/390/768/1440 px 目录、7 个后台路由、390 px 后台表格/表单、语言/验证文案切换及登录借还通过，无溢出或脚本错误 |
| 本地生命周期 | 目录/搜索、借阅/续借/预约/FIFO 领取/归还、角色隔离及管理员创建/上架通过 |
| 本地捕获邮件 | 使用测试邮件完成注册、验证、找回密码及旧会话撤销 |
| 交互式 API 文档 | Schema 引用可解析，Swagger 登录获取 CSRF 并保留会话 Cookie |
| 部署配置 | 生产/本地/构建 Compose 组合及 Caddy 配置验证通过 |
| CI 容器运行 | 同一提交的 Web/API/PostgreSQL 健康；UID 10001、可写持久卷、只读应用文件系统、SPA/深链接及构建资源通过 |
| 代理 HTTP 生命周期 | 会话/CSRF、独立身份、后台权限、上架/借阅/重复借阅/归还/历史通过 |
| 部署验证 | 可信 HTTPS、安全 Cookie、借还/角色浏览器检查、重建持久化及独立数据库恢复通过 |
| 公网 HTTPS 备用入口 | 独立 IPv4 健康/TLS 探测及登录浏览器生命周期通过；后续双语产物另通过匿名语言/布局检查 |
| 生产 SMTP | 传输认证及 SMTP 客户端自检提交/收件确认通过；应用 JavaMail 端到端验收待完成 |

CI 使用临时演示数据，以及仅用于回环 HTTP 测试的非 Secure Cookie 覆盖值。生产保留 Secure Cookie，已通过独立 HTTPS 浏览器检查。CI 本身不证明公网可达。

## 待完成验收

- 公网 IPv6 主入口可达性待验收，备用入口成功是独立证据。
- 应用 JavaMail 注册、密码找回及借阅通知的实际收件检查待完成；SMTP 客户端自检不代表这些流程已通过。
- 数据库已在独立数据库内恢复验证。媒体归档可读及文件保留通过，但尚未验证完整媒体恢复。

重现及维护方式见[运维手册](runbook.zh-CN.md)。真实地址、账号、密钥、外部探测编号及主机日志保留在私有部署记录中。
