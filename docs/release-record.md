# Verified application and container delivery

English | [简体中文](release-record.zh-CN.md)

This record connects public source, CI verification and immutable container artifacts. Environment-specific access details and private operational records are maintained separately. Acceptance scope and remaining limits are in [deployment validation](nas-validation.md).

Source history was rewritten to remove private deployment documentation. Source links below identify the corresponding sanitized commits; their application files are identical to the original build sources. Existing CI records and immutable image tags retain their build-time identifiers.

## Public evidence

| Evidence | Reference |
| --- | --- |
| Sanitized API/application source equivalent | [d9d0529d2edbb81cb1f78aaa713b2d7b02812b9d](https://github.com/G-GortoN/e-library-service/commit/d9d0529d2edbb81cb1f78aaa713b2d7b02812b9d) |
| Original complete workflow | [Verify and publish — succeeded](https://github.com/G-GortoN/e-library-service/actions/runs/44156418893) |
| Sanitized bilingual UI source equivalent | [8e5bb2234ae0b4952f8d7d011880b1ee83c417d3](https://github.com/G-GortoN/e-library-service/commit/8e5bb2234ae0b4952f8d7d011880b1ee83c417d3) |
| Bilingual complete workflow | [CI run 44436983590 — succeeded](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) |
| Target platform | `linux/amd64` |
| Publication | GHCR; anonymous manifest access verified for both application images |

## Validated artifact references

The following combination has deployment validation evidence: API corresponding to `d9d0529`, bilingual Web corresponding to `8e5bb22` and the pinned PostgreSQL image. These are artifact references, not disclosure of a deployment's private configuration. Set the remaining environment values locally.

```dotenv
API_IMAGE=ghcr.io/g-gorton/e-library-service-api@sha256:0a424f5ffcab40ae11d7560838be4a9cc027cf7590c0be8c83fa537439b40839
WEB_IMAGE=ghcr.io/g-gorton/e-library-service-web@sha256:378ac104ddda21b7ffccd55fe5359343e3b2beff8dd237385ee5dd4b7c3c53b4
DB_IMAGE=public.ecr.aws/docker/library/postgres@sha256:005c5c37db96c1e6652a79ea31f9886402fba81ac95dc2db897739121dd7f8f2
```

The PostgreSQL `linux/amd64` manifest was verified identical between Docker Hub and Docker's official ECR Public publisher. The registry override changes the download source, not database content or application code.

Source tags use `sha-<full-commit-sha>`. Workflow `image-reference-api` and `image-reference-web` artifacts retain published digest records. A successful workflow can publish new images without changing a separately pinned deployment; validate and explicitly promote each chosen artifact.

## Verified behavior

| Check | Result |
| --- | --- |
| Backend | 16 tests passed with zero failures/errors/skips: 15 real HTTP/PostgreSQL integration tests and one rate-limit unit test |
| Database test environment | Dedicated PostgreSQL locally; Docker/Testcontainers 2.0.5 with PostgreSQL 17 in CI |
| Frontend | Seven tests, TypeScript checking and production build passed |
| Local bilingual browser | 320/390/768/1440 px catalog, seven admin routes, 390 px admin tables/forms, language/validation switching and authenticated borrowing/return passed without overflow or script errors |
| Local lifecycle | Catalog/search, borrow/renew/reserve/FIFO claim/return, role isolation and administrator create/publish passed |
| Local captured mail | Registration, verification, recovery and old-session revocation passed using captured test mail |
| Interactive API documentation | Schema references resolve; Swagger login obtains CSRF and retains its session cookie |
| Deployment configuration | Production/local/build Compose combinations and Caddy configurations validated |
| CI container runtime | Same-commit Web/API/PostgreSQL stack became healthy; UID 10001, writable volumes, read-only application filesystems, SPA/deep links and built assets passed |
| Proxied HTTP lifecycle | Sessions/CSRF, separate identities, admin permissions, publish/borrow/duplicate/return/history passed |
| Deployment verification | Trusted HTTPS, secure cookies, lending/role browser checks, recreation persistence and isolated database restoration passed |
| Public HTTPS fallback | Independent IPv4 health/TLS checks and authenticated browser lifecycle passed; later bilingual assets also passed anonymous language/layout checks |
| Production SMTP | Transport authentication and SMTP-client self-test submission/receipt confirmed; application JavaMail end-to-end acceptance pending |

CI uses disposable demo data and a test-only non-Secure cookie override for loopback HTTP. Production retains Secure cookies, verified separately through HTTPS browser checks. CI alone does not establish public reachability.

## Remaining acceptance

- Public IPv6-primary reachability remains pending; fallback success is independent evidence.
- Application JavaMail registration, password recovery and lending-notification inbox checks remain pending. SMTP-client self-test success does not establish those workflows.
- Database restoration passed in an isolated database. Media archive readability and retention passed, but complete media restoration remains unverified.

Reproduction and maintenance instructions are in the [runbook](runbook.md). Keep live addresses, accounts, secret values, external probe identifiers and host-specific logs in a private deployment record.
