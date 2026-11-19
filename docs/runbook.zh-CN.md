# 开发与 NAS 运维手册

[English](runbook.md) | 简体中文

本手册说明可复现的本地开发、容器部署与验收步骤。部署地址、账号、凭据、网络拓扑和运维日志由操作人在私有配置与记录中维护；公开文档仅使用占位值。

公开验证证据：[CI 运行 44436983590](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) 针对双语应用源码通过了 16 项后端测试、七项前端测试、类型检查、构建、Compose/Caddy 检查、镜像发布及实际容器冒烟。CI 成功不代表任意生产部署已通过网络与邮件验收；部署验收范围见 [NAS 验证说明](nas-validation.zh-CN.md)。

## 1. 入口与环境要求

| 用途 | 地址或要求 |
| --- | --- |
| 前端开发 | `http://localhost:5173`；Vite 将 API 与媒体代理到 8080 |
| API 开发 | `http://localhost:8080`；需要 Java 21 和 PostgreSQL 17 |
| 本地数据库与邮件 | Compose 在回环地址提供 PostgreSQL 5433、SMTP 1025、Mailpit 界面 8025 |
| NAS 私有内部入口 | `http://127.0.0.1:18081`；供宿主机 Funnel 或现有可信反向代理使用 |
| IPv6 主入口 | `https://library.example.invalid:4443`；替换为经过外部 IPv6 网络验证的主机名 |
| 公网备用入口 | 由操作人私下提供 Funnel HTTPS 地址，并通过外部 IPv4 网络验证 |

使用 Docker Compose v2 或更新版本、用于冒烟与配置检查的 Python 3，以及已有授权的 Docker 访问。如果 NAS Docker 需要 sudo，在终端交互执行带 sudo 的部署命令。脚本不会更改 Docker socket 权限、账号组、SSH 配置或现有 NAS 服务。

## 2. 本地开发与集成测试

在仓库根目录运行：

```sh
docker compose -f deploy/compose.local.yml up -d --wait
```

API 使用 `SPRING_PROFILES_ACTIVE=local`、`DATABASE_URL=jdbc:postgresql://localhost:5433/elibrary` 和 `DATABASE_USERNAME=elibrary`。在本地私有环境中设置与 Compose 数据库配置一致的 `DATABASE_PASSWORD`。local 配置启用演示数据，并仅为回环 HTTP 使用非 Secure Cookie。SMTP 默认 localhost:1025；Mailpit 捕获邮件，不向外投递。

```sh
cd backend
./mvnw verify
```

测试通过 Testcontainers 或[后端指南](../backend/README.zh-CN.md)中的外部测试数据库配置使用真实 PostgreSQL。测试会重置数据，必须使用独立测试库。前端在 `frontend/` 执行 `npm ci`、`npm test`、`npm run typecheck`、`npm run build`，开发使用 `npm run dev`。

演示种子数据需要同时设置 `APP_SEED_DEMO=true` 和 `local` 或 `demo` 配置。合成测试凭据保留在本地测试环境中，不写入部署文档。管理员初始化必须通过私有配置显式设置 `APP_ADMIN_EMAIL`、`APP_ADMIN_PASSWORD`，生产没有默认管理员密码。生产环境保持演示数据初始化关闭。

## 3. 镜像与部署配置

工作流执行后端测试、前端检查、Compose 校验和 Caddy 校验。[运行 44436983590](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) 已通过上述检查，发布两个 `linux/amd64` 镜像，并在 `container-smoke` 通过后整体成功。发布仅限 `main` 上通过检查的推送或手动运行，PR 不发布包。Actions 固定到已核实的上游提交 SHA。

两个镜像发布后，`container-smoke` 使用只读 GHCR 令牌拉取同一提交 SHA 的镜像，在临时 runner 上启动真实 Web/API/PostgreSQL 容器。成功运行已验证三个服务健康、Web/API 进程使用 UID 10001、媒体及 Caddy 持久化卷可写、应用文件系统只读。SPA、深层页面与真实构建的 JavaScript 资源均通过检查，再通过 `http://127.0.0.1:18081` 完成登录后冒烟，覆盖 Web 代理、登录/CSRF、角色隔离以及上架/借阅/归还/历史流程。失败时仅输出临时服务的日志末尾，CI 任务结束后用 `down -v` 清理临时容器及数据卷。

`deploy/compose.verify.yml` **仅供测试**，不是生产部署配置。它只覆盖 `APP_COOKIE_SECURE=false`，供临时回环 HTTP 测试保留会话；CI 另行启用 demo 种子数据、关闭邮件并注入合成管理员和数据库凭据。生产保持 Secure Cookie 默认值。镜像发布先于运行检查，因此选择部署摘要前应确认包括 `container-smoke` 的整个工作流成功。更新镜像需由操作人显式选择。

镜像名称如下，替换为实际提交：

```text
ghcr.io/g-gorton/e-library-service-api:sha-<commit>
ghcr.io/g-gorton/e-library-service-web:sha-<commit>
```

每个发布任务上传包含不可变摘要的 `image-reference-*` 产物，已验证的镜像对见[发布记录](release-record.zh-CN.md)。两个已发布的 API/Web 包均已实测匿名读取 manifest 返回 HTTP 200，拉取本次公开发布镜像无需手动修改可见性或登录包仓库。若使用私有 fork 或替换为私有包，再在 NAS 配置只读包凭据，不提交到仓库。

准备部署目录和私有配置：

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
mkdir -p deploy/certs
```

替换全部 `replace-with-*` 和 `.invalid` 占位。将 `API_IMAGE`、`WEB_IMAGE` 设为已验证的 SHA 标签，优先使用 `ghcr.io/...@sha256:...` 摘要引用。设置独立数据库和管理员密码、可信 HTTPS `APP_PUBLIC_BASE_URL` 及主机名。生产默认 `APP_PROFILE=prod`、`APP_SEED_DEMO=false`，启用 Secure Cookie。

`DB_IMAGE` 默认使用 `postgres:17-alpine`。NAS 无法访问 Docker Hub 时，可选择 [Amazon ECR Public 上的 Docker Official Images 命名空间](https://aws.amazon.com/blogs/containers/docker-official-images-now-available-on-amazon-elastic-container-registry-public/)。以下 `linux/amd64` 子 manifest 摘要已在两个 registry 核对，与同一 `17-alpine` 镜像一致：

```dotenv
DB_IMAGE=public.ecr.aws/docker/library/postgres@sha256:005c5c37db96c1e6652a79ea31f9886402fba81ac95dc2db897739121dd7f8f2
```

选用或更新引用前，核对目标版本、架构和匹配的上游摘要；该摘要仅针对特定架构，不能当作通用多平台引用。仅在本项目环境中设置备用来源，无需更改 Docker daemon 全局镜像源。

`deploy/compose.yml` 仅运行 Web/API/数据库。`deploy/compose.local.yml` 提供本地数据库与邮件依赖。排障时可用已配置的环境变量组合生产与构建文件，在本地构建镜像：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml -f deploy/compose.build.yml build
```

## 4. 复制与 NAS 启动

配置复制工具使用自行指定的 SSH 目标，仓库不保存个人主机名：

```sh
NAS_SSH_TARGET=operator@nas.example.invalid NAS_PROJECT_DIR=/volume1/docker/e-library-service \
./deploy/scripts/push-config.sh
```

它仅复制公开部署文件，不复制 `.env` 或凭据，也不启动容器。公开配置文件会明确设为 `644`，使非 root Web 用户能在带有限制性继承 ACL 的 NAS 共享目录中读取它们。在 NAS 上准备私有 `.env` 和证书后，从项目目录运行：

```sh
sudo ./deploy/scripts/deploy.sh
```

账号已有授权的 Docker 访问时可不使用 sudo。脚本检查配置、拉取指定镜像、等待健康状态并输出镜像清单，不开放防火墙，也不配置 DNS/Funnel。持久化命名卷保留数据库、媒体与 Caddy 状态。更新时不要执行 `down -v`。

无需 Docker daemon 权限的配置检查：

```sh
NAS_SSH_TARGET=operator@nas.example.invalid python3 deploy/scripts/validate-config-remote.py
```

该工具仅将公开示例发送至远端临时目录，执行 `docker compose config --quiet` 后清理，不启动容器。

## 5. NAS 已占用端口时的 IPv6 与 HTTPS

为目标部署分别验证 DNS、证书、容器健康与真实外网入站。局域网成功不能证明公网可达。以下为可复现的配置步骤，不代表任何具体主入口已完成验收。

申请支持 IPv6 的 DDNS 主机名，例如免费的 [dynv6 主机名](https://dynv6.com/)，将 AAAA 更新为 NAS 可路由的公网地址。链路本地 `fe80::/10` 和私有 ULA `fc00::/7` 不能作为公网入口。运营商前缀变化时，DDNS 必须跟踪 NAS 地址，不能只填写路由器 WAN 地址。

核对运营商入站策略、路由器与 NAS IPv6 防火墙，以及 IPv6 监听。主入口需要放行所选公网端口的 IPv6 入站规则，不能用 IPv4 NAT 端口映射代替。

默认配置有意避开 NAS 的 80/443。公网 HTTPS 使用宿主机 4443 映射 Caddy 8443，HTTP 内部入口保持回环 18081。标准 HTTP-01/TLS-ALPN ACME 端口不可用时，通过现有可信反向代理、外部 DNS-01 ACME 客户端或其他获准流程申请及续期有效证书。标准 Caddy 镜像不包含任意 DNS 服务商插件。

将证书链和私钥置于 `deploy/certs/fullchain.pem`、`deploy/certs/privkey.pem`。Web 容器以 UID/GID 10001 运行，必须能读取该独立目录。仔细核对目录后，可以采用：

```sh
sudo chown -R 10001:10001 deploy/certs
sudo chmod 700 deploy/certs
sudo chmod 600 deploy/certs/fullchain.pem deploy/certs/privkey.pem
```

设置 `CADDY_CONFIG_FILE=./Caddyfile.https`、`PUBLIC_HOSTNAME=<ddns-hostname>`、`APP_PUBLIC_BASE_URL=https://<ddns-hostname>:4443` 后部署。`Caddyfile.https` 只加载提供的证书，不负责申请与续期。外部续期完成后，仅重启 Web 以加载新文件：

```sh
sudo docker compose --env-file deploy/.env -f deploy/compose.yml restart web
```

默认 `Caddyfile` 只提供私有 HTTP 内部入口。未选择 HTTPS 配置或未提供有效证书时，仅发布 4443 端口不会产生公网 HTTPS 服务。不要把私有 HTTP 入口公开用来替代 HTTPS 登录。

## 6. Funnel 备用与邮件

核对 Tailscale 账号策略和安装后，通过当前版本支持的命令将回环入口发布到 Funnel（[官方指南](https://tailscale.com/docs/features/tailscale-funnel)），常见命令为：

```sh
tailscale funnel --bg --https=8443 http://127.0.0.1:18081
tailscale funnel status
```

Funnel 是公开 HTTPS 入口，普通 tailnet 访问或单独的 Serve 仍是私网。访客不需要 Tailscale。在私有部署交接中同时提供主、备用链接；主站打不开时，访客无法使用只放在主站上的切换按钮。仅限本机的 Cookie 意味着切换主机名后需要重新登录。将 `APP_PUBLIC_BASE_URL` 设置为收件人已确认可访问的入口。IPv6 入站尚未完成时，可将已验证的 Funnel 作为邮件主入口，并将 `APP_PUBLIC_BACKUP_BASE_URL` 留空。两个入口均验证后，可改为 IPv6 主入口和可选的 Funnel 备用入口，邮箱验证与密码恢复邮件便会同时附两个链接，供 IPv4-only 收件人使用备用地址。备用配置留空时仍只有主链接。两个链接使用同一个一次性令牌，通过任一入口完成操作后即消费令牌，不从任意 Host 请求头拼接这些地址。

启用生产邮件时，设置 `APP_MAIL_ENABLED=true`、`APP_MAIL_FROM`，以及服务商的 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_AUTH`、`SMTP_STARTTLS`、`SMTP_SSL`。587 端口通常使用 STARTTLS，465 端口通常使用隐式 TLS；以服务商要求为准，不同时开启两种模式。使用受控收件箱验证应用实际生成的邮箱确认、密码恢复和借阅通知，分别记录配置、SMTP 接受与实际收件。API 健康或通道自检成功不能证明完整应用投递。仓库环境示例默认关闭邮件。

[生产邮件配置指南](production-mail.zh-CN.md)提供 QQ SMTP 示例、私有配置和仅重建 API 的步骤。

## 7. HTTP 冒烟与功能验收

仅检查匿名只读接口：

```sh
python3 deploy/scripts/smoke.py --base-url http://localhost:8080
```

需登录的流程检查，先在本地环境中私下设置 `SMOKE_EMAIL`、`SMOKE_PASSWORD`、`SMOKE_ADMIN_EMAIL`、`SMOKE_ADMIN_PASSWORD`，再运行：

```sh
python3 deploy/scripts/smoke.py --base-url https://library.example.invalid:4443 --exercise
```

local 配置使用本地直连 API；生产 Secure Cookie 使用有效 HTTPS 公网入口。`--exercise` 创建唯一名称的书籍，执行上架、借阅、归还，检查历史和角色隔离，最后归档该书并保留审计历史，不删除生产记录。匿名检查通过不表示已运行登录流程检查。

还需验证预约优先权与过期、续借限制、账号禁用与会话失效、上下架、通知去重重试、逾期金额边界、上传与 CSV 错误、新部署持久化，以及完整读者/管理界面。CSV 必填表头为 `title,author,category`，可选 `isbn,description`；先预览，处理全部非法行后再导入。

## 8. 备份、更新与回滚

更新前执行：

```sh
sudo ./deploy/scripts/backup.sh
```

备份包含 PostgreSQL 自定义格式导出、媒体归档、镜像清单、部署环境以及已提供的证书文件。使用私有目录权限，数据库与媒体命令成功后才将文件标记为完成。另行安全保存 NAS 之外的副本，并在独立数据库中验证恢复。上传仍在变化时复制媒体不是全应用原子快照；需要一致时间点副本时使用维护窗口。

恢复验收应将 dump 恢复到独立数据库，核对预期书目与业务记录，并通过应用验证提取后的媒体。仅列出媒体归档只能证明可读性。另行验证容器重建后数据库和媒体仍保留，并私下保存结果。

更新前保留上一版环境与镜像引用，选定经过验证的新摘要后运行部署脚本。镜像回滚不会撤销数据库迁移，只能回退到兼容当前结构的应用，或执行明确规划的恢复；不要盲目降级数据库或丢弃数据卷。

## 9. 外部验收与交付

从真实外部 IPv6 网络验证主入口，从仅支持 IPv4 的网络验证 Funnel 备用入口。检查可信 TLS、精确 `/healthz` 响应、桌面与手机页面、登录与安全 Cookie、CSRF 借还及角色权限。确认 DDNS 地址变化和证书续期后入口仍可使用。

按 [NAS 验证说明](nas-validation.zh-CN.md)记录每项通过、未执行或失败的状态。部署地址与测试账号由操作人私下交付，原始网络探针结果和运维日志不提交公开仓库。SMTP 通道自检与应用生成邮件的端到端收件应分别验收。
