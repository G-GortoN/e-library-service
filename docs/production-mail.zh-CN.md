# 生产邮件配置

[English](production-mail.md) | 简体中文

本指南说明如何配置认证 SMTP，并分别验证连接、服务端接受和应用邮件实际收件。邮箱地址与授权码只保存在操作人的私有环境中，公开示例使用占位值。SMTP 通道自检不能替代注册、找回密码及借阅通知的端到端验收。

## 选择发件邮箱

QQ 邮箱可作为少量演示邮件的认证 SMTP 服务示例。应用通过服务商向外发信，无需增加邮件容器、开放收信端口或购买域名。

按照 [QQ 邮箱官方授权码指引](https://help.mail.qq.com/detail/106/985)操作：

1. 在电脑浏览器登录 QQ 邮箱，点右上角头像，依次进入 **设置 → 账号与安全 → 安全设置**。
2. 开启 **POP3/IMAP/SMTP** 服务。
3. 点击 **生成授权码**，按页面要求用 QQ 密码或手机 QQ 扫码验证身份。
4. 复制生成的 16 位授权码，并添加便于以后管理的备注。

用户名填完整发件邮箱，SMTP 密码填该客户端授权码。服务器为 `smtp.qq.com`，465 端口使用隐式 TLS，见[腾讯 QQ SMTP 示例](https://cloud.tencent.com/document/product/583/35399)。

`APP_MAIL_FROM` 应与 `SMTP_USERNAME` 使用同一邮箱，除非服务商已验证并允许其他发件身份。网站的 DDNS 主机名本身不会提供邮箱，也不等于已获得发件地址授权。其他支持认证 SMTP 的邮箱也可接入，服务器和客户端凭据需以对应服务商文档为准。

## 修改 NAS 私有配置

通过本地有权限的终端编辑 NAS 上现有的 `deploy/.env`，保留镜像摘要、数据库配置和应用密钥。授权码只填入私有配置，不发到聊天、GitHub、截图或命令行参数中。

使用 QQ 邮箱的 465 隐式 TLS 时，将下面所有占位值替换为真实信息：

```dotenv
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USERNAME=replace-with-full-sender-address
SMTP_PASSWORD='replace-with-client-authorization-code'
SMTP_AUTH=true
SMTP_STARTTLS=false
SMTP_SSL=true
APP_MAIL_FROM=replace-with-the-same-sender-address
APP_MAIL_ENABLED=true
```

dotenv 文件中使用单引号可避免 `$` 等字符被插值。密码应使用服务商的授权码，不是网页登录密码。

两种加密模式二选一：

| 服务商要求的模式 | `SMTP_PORT` | `SMTP_SSL` | `SMTP_STARTTLS` |
| --- | --- | --- | --- |
| 隐式 TLS | 465 | `true` | `false` |
| STARTTLS，需服务商支持 | 587 | `false` | `true` |

不要同时开启两种模式。[Google SMTP 协议文档](https://developers.google.com/workspace/gmail/imap/imap-smtp)也说明了它们的区别，但不能据此假设每家服务商都支持这两个端口。

账号邮件中的链接应使用经过独立验证、收件人确实能打开的 HTTPS 入口。将以下虚构占位值替换为选定的主入口：

```dotenv
APP_PUBLIC_BASE_URL=https://library.example.invalid
APP_PUBLIC_BACKUP_BASE_URL=
```

IPv6 与 Funnel 入口均通过外网验证后，选定一个主入口，并可将另一个设置为 `APP_PUBLIC_BACKUP_BASE_URL`。这些可信 URL 决定验证和找回密码邮件中的链接，不会改变 Web 监听或 DNS。若同时设置两个地址，任一链接完成操作都会消耗同一个一次性令牌。

在 NAS 项目目录保护配置文件，并仅重建 API，让新环境变量生效：

```sh
sudo chmod 600 deploy/.env
sudo docker compose --env-file deploy/.env -f deploy/compose.yml \
  up -d --no-deps --wait --wait-timeout 180 api
```

仅执行 `docker compose restart api` 不会加载修改后的环境变量。SMTP 配置不要进入版本控制，也不要打印完整 Compose 解析配置，因为其中含有密钥。NAS 需能向服务商的 SMTP 端口建立出站 TCP 连接；发信无需新增路由器入站规则。

## 验证真实投递

每个部署环境均需执行以下应用层检查。使用自己控制的收件地址，或已同意接收测试邮件的收件人：

1. 从公网网站注册一个新的测试读者，检查真实收件箱和垃圾箱，打开验证链接、完成验证并登录。
2. 为该测试账号申请找回密码，打开真实邮件设置新密码，确认旧密码和旧会话失效。
3. 使用该账号借书并归还，确认站内通知和邮件均收到；测试完成后归还测试借阅。

投递任务默认每 15 秒执行，失败最多尝试五次，重试之间会等待。注册/重置请求成功、消息入队或容器健康，都不代表邮件已经收到。邮件关闭期间产生的通知不会在开启后自动补发为邮件。

认证失败时检查 SMTP 开关、完整用户名、当前授权码、发件身份与 TLS 模式；连接超时则核对 NAS 出站 DNS/TCP。未收到邮件时检查垃圾箱及服务商发信限制。投递状态应在本地私下查看，不暴露正文、链接或凭据。若暂时无法配通，恢复 `APP_MAIL_ENABLED=false` 并重建 API；管理员创建账号和站内通知仍可使用。

其他部署步骤见[运维手册](runbook.zh-CN.md)，验收范围与记录方法见 [NAS 验证说明](nas-validation.zh-CN.md)。
