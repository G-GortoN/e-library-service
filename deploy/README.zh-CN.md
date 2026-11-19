# 部署

[English](README.md) | 简体中文

本目录提供部署定义。主机名、连接资料、凭据和环境专属验收证据保存在私有部署记录中，公开文档使用占位符。

- `compose.yml`：生产 Web/API/PostgreSQL、固定镜像引用、持久化卷、健康检查和日志轮换。
- `compose.local.yml`：仅回环地址可访问的 PostgreSQL 与 Mailpit，供本地开发。
- `compose.build.yml`：可选的本地镜像构建覆盖配置。
- `Caddyfile`：私有 HTTP 内部入口；`Caddyfile.https`：加载提供的证书并提供 IPv6 HTTPS。
- `.env.example`：仅公开占位配置；复制为被忽略的 `.env` 并替换。
- `scripts/`：配置复制与校验、显式部署、备份和真实 HTTP 冒烟检查。

启动前请阅读完整[运维手册](../docs/runbook.zh-CN.md)。默认公网 HTTPS 端口 4443，因为 NAS 的 80/443 可能已被其他服务占用；回环 18081 可供宿主机 Funnel 备用使用。脚本不会修改 Docker 权限、个人 SSH 配置、防火墙策略或其他 NAS 服务。

`DB_IMAGE` 默认使用 `postgres:17-alpine`。Docker Hub 无法访问时，可为本项目选择 [ECR Public 上的 Docker Official Images 仓库](https://aws.amazon.com/blogs/containers/docker-official-images-now-available-on-amazon-elastic-container-registry-public/)：

```dotenv
DB_IMAGE=public.ecr.aws/docker/library/postgres@sha256:005c5c37db96c1e6652a79ea31f9886402fba81ac95dc2db897739121dd7f8f2
```

该 `linux/amd64` 子摘要经核对与上游 `17-alpine` 镜像一致。选用或更新前应核对版本、架构和上游摘要，详见[运维手册](../docs/runbook.zh-CN.md#3-镜像与部署配置)。无需更改 Docker daemon 全局镜像源。
