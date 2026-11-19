# Deployment

English | [简体中文](README.zh-CN.md)

Deployment definitions are in this directory. Keep hostnames, access details, credentials and host-specific acceptance evidence in private deployment records; public documentation uses placeholders.

- `compose.yml`: production web/API/PostgreSQL, fixed image references, persistent volumes, health checks and log rotation.
- `compose.local.yml`: loopback-only PostgreSQL and Mailpit for local development.
- `compose.build.yml`: optional local image-build override.
- `Caddyfile`: private HTTP origin; `Caddyfile.https`: supplied TLS certificates and IPv6 HTTPS.
- `.env.example`: public placeholders only; copy to ignored `.env` and replace them.
- `scripts/`: configuration copy/validation, explicit deployment, backup and real HTTP smoke checks.

Read the complete [runbook](../docs/runbook.md) before starting. The default public HTTPS port is 4443 because existing NAS services may own 80/443. The loopback origin on 18081 is suitable for a host-side Funnel fallback. No script changes Docker privileges, personal SSH configuration, firewall policy or other NAS services.

`DB_IMAGE` defaults to `postgres:17-alpine`. If Docker Hub is unreachable, the [Docker Official Images repository on ECR Public](https://aws.amazon.com/blogs/containers/docker-official-images-now-available-on-amazon-elastic-container-registry-public/) provides an optional project-specific source:

```dotenv
DB_IMAGE=public.ecr.aws/docker/library/postgres@sha256:005c5c37db96c1e6652a79ea31f9886402fba81ac95dc2db897739121dd7f8f2
```

This `linux/amd64` child digest matched the upstream `17-alpine` image when checked. Verify version, architecture and the upstream digest before selecting or updating it; see the [runbook](../docs/runbook.md#3-images-and-deployment-configuration). No global Docker daemon mirror change is required.
