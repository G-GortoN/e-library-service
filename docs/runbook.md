# Development and NAS Runbook

English | [简体中文](runbook.zh-CN.md)

This runbook describes reproducible local development, container deployment and acceptance. Operators keep deployment addresses, accounts, credentials, network topology and operational logs in private configuration and records; public examples use placeholders.

Public verification: [CI run 44436983590](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) passed 16 backend tests, seven frontend tests, type checking, builds, Compose/Caddy checks, image publication and actual container smoke checks for the bilingual application source. Passing CI does not establish network or email acceptance for an arbitrary production deployment; see the [NAS validation scope](nas-validation.md).

## 1. Entry points and requirements

| Purpose | Address / requirement |
| --- | --- |
| Frontend development | `http://localhost:5173`; Vite proxies API and media to port 8080 |
| API development | `http://localhost:8080`; Java 21 and PostgreSQL 17 |
| Local database / mail | Compose publishes PostgreSQL on loopback 5433, SMTP 1025 and Mailpit UI 8025 |
| NAS private origin | `http://127.0.0.1:18081`; intended for host-side Funnel or an existing trusted proxy |
| IPv6 primary | `https://library.example.invalid:4443`; replace with a hostname verified from an external IPv6 network |
| Public fallback | Operator-provided Funnel HTTPS URL, verified from an external IPv4 network |

Use Docker Compose v2 or later, Python 3 for smoke/config checks, and a Docker account with existing authorized access. If NAS Docker requires sudo, run the deployment command interactively with sudo. The scripts do not change Docker socket permissions, account groups, SSH configuration, or existing NAS services.

## 2. Local development and integration tests

From the repository root:

```sh
docker compose -f deploy/compose.local.yml up -d --wait
```

Run the API with `SPRING_PROFILES_ACTIVE=local`, `DATABASE_URL=jdbc:postgresql://localhost:5433/elibrary` and `DATABASE_USERNAME=elibrary`. Set `DATABASE_PASSWORD` privately to match your local Compose database configuration. The local profile enables demonstration data and non-Secure cookies for loopback HTTP only. SMTP defaults to localhost:1025; Mailpit captures mail rather than delivering it externally.

```sh
cd backend
./mvnw verify
```

Tests use real PostgreSQL through Testcontainers or the external test database configuration in the [backend guide](../backend/README.md). Use an isolated test database because tests reset their data. Run `npm ci`, `npm test`, `npm run typecheck` and `npm run build` inside `frontend/`. Frontend development uses `npm run dev`.

Demo seeding requires both `APP_SEED_DEMO=true` and the `local` or `demo` profile. Keep synthetic test credentials in the local test environment rather than deployment notes. Administrator bootstrap requires explicit, privately supplied `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD`; production supplies no default administrator password. Keep demo seeding disabled in production.

## 3. Images and deployment configuration

The workflow runs backend tests, frontend checks, Compose validation and Caddy validation. [Run 44436983590](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) passed those checks, published both `linux/amd64` images and completed successfully including `container-smoke`. Publishing is restricted to successful checks on `main` pushes/manual runs; pull-request jobs do not publish packages. Actions are pinned to verified upstream commit SHAs.

After both images publish, `container-smoke` pulls their matching commit-SHA tags using a read-only GHCR token and starts the actual Web/API/PostgreSQL containers on a disposable runner. The successful run verified all three services healthy, Web/API processes running as UID 10001, writes to persistent media/Caddy volumes and read-only application filesystems. It served the SPA, a deep link and a real built JavaScript asset, then passed the authenticated smoke script through `http://127.0.0.1:18081`, exercising the Web proxy, login/CSRF flow, role separation and publication/borrow/return/history lifecycle. Failure logs are limited to the temporary services; CI containers and volumes are removed with `down -v` after the job.

`deploy/compose.verify.yml` is **TEST ONLY**, not a production deployment configuration. It overrides only `APP_COOKIE_SECURE=false` for ephemeral loopback HTTP sessions; CI separately enables demo seed data, disables email and supplies synthetic administrator/database credentials. Production retains secure-cookie defaults. Publication precedes the runtime check: select deployment digests only after the entire workflow, including `container-smoke`, succeeds. Operators select image updates explicitly.

Images use these names, with the actual commit substituted:

```text
ghcr.io/g-gorton/e-library-service-api:sha-<commit>
ghcr.io/g-gorton/e-library-service-web:sha-<commit>
```

Each publishing job uploads an `image-reference-*` artifact containing the immutable digest; the verified pair is listed in the [release record](release-record.md). Both published API/Web packages were checked anonymously and returned HTTP 200 for their manifests, so no manual visibility change or package login is required to pull these public release images. If using a private fork or private replacement packages, configure read-only package credentials on the NAS and never commit them.

Prepare the deployment directory and private configuration:

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
mkdir -p deploy/certs
```

Replace every `replace-with-*` and `.invalid` placeholder. Set `API_IMAGE` and `WEB_IMAGE` to verified SHA tags or, preferably, `ghcr.io/...@sha256:...` references. Supply unique database and administrator passwords, the trusted HTTPS `APP_PUBLIC_BASE_URL`, and the selected hostname. Production defaults to `APP_PROFILE=prod`, `APP_SEED_DEMO=false` and secure cookies.

`DB_IMAGE` defaults to `postgres:17-alpine`. If Docker Hub is unreachable from the NAS, an optional source is the [Docker Official Images namespace on Amazon ECR Public](https://aws.amazon.com/blogs/containers/docker-official-images-now-available-on-amazon-elastic-container-registry-public/). For `linux/amd64`, the following child-manifest digest was checked against both registries and matched the same `17-alpine` image:

```dotenv
DB_IMAGE=public.ecr.aws/docker/library/postgres@sha256:005c5c37db96c1e6652a79ea31f9886402fba81ac95dc2db897739121dd7f8f2
```

Verify the intended version, architecture and matching upstream digest before selecting or updating this reference; this architecture-specific digest is not a universal multi-platform reference. Set a fallback only in this project environment; no global Docker daemon mirror change is needed.

`deploy/compose.yml` runs web/API/database only. `deploy/compose.local.yml` supplies local database/mail dependencies. To build images locally for troubleshooting, combine the production and build files with configured environment values:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml -f deploy/compose.build.yml build
```

## 4. Copy and start on the NAS

A configuration-only helper accepts your own SSH target; no personal hostname is stored in the repository:

```sh
NAS_SSH_TARGET=operator@nas.example.invalid NAS_PROJECT_DIR=/volume1/docker/e-library-service \
./deploy/scripts/push-config.sh
```

It copies public deployment files, not your `.env` or credentials, and does not start containers. Public configuration files are set to mode `644` so the non-root Web process can read them when the shared directory has restrictive inherited ACLs. Prepare the private `.env` and certificates on the NAS, then run from its project directory:

```sh
sudo ./deploy/scripts/deploy.sh
```

If the account already has authorized Docker access, sudo is unnecessary. The script checks configuration, pulls the selected images, waits for health, and prints the image inventory. It does not open firewalls or configure DNS/Funnel. Persistent named volumes retain database, media, and Caddy state. Do not use `down -v` as an update command.

For configuration-only verification without Docker daemon access:

```sh
NAS_SSH_TARGET=operator@nas.example.invalid python3 deploy/scripts/validate-config-remote.py
```

This sends only public examples to an ephemeral remote directory, runs `docker compose config --quiet`, removes the directory, and starts no containers.

## 5. IPv6 and HTTPS on a NAS with occupied ports

Verify DNS, certificates, container health and genuine external ingress separately for each deployment. LAN success does not establish Internet reachability. The following reproducible steps do not assert acceptance of any particular public endpoint.

Obtain an IPv6-capable DDNS hostname (for example, a free [dynv6 hostname](https://dynv6.com/)), then update its AAAA record to the NAS routable global address. Link-local `fe80::/10` and private ULA `fc00::/7` addresses cannot be used as the public route. If the ISP prefix changes, DDNS must follow the NAS address, not merely a router WAN address.

Check ISP inbound policy, router and NAS IPv6 firewalls, and IPv6 listener behavior. The primary route needs an inbound IPv6 rule for the chosen public port. IPv4 NAT port forwarding is not a substitute.

The provided defaults deliberately avoid NAS ports 80/443. Public HTTPS uses host port 4443 mapped to Caddy port 8443, while the HTTP origin stays on loopback 18081. Since the standard HTTP-01/TLS-ALPN ACME ports are unavailable, obtain/renew a valid certificate through an existing trusted reverse proxy, an external DNS-01 ACME client, or another approved certificate process. The standard Caddy image does not include arbitrary DNS-provider plugins.

Place the certificate chain and private key at `deploy/certs/fullchain.pem` and `deploy/certs/privkey.pem`. The web container runs as UID/GID 10001 and must be able to read that dedicated directory. One option, after carefully checking the directory, is:

```sh
sudo chown -R 10001:10001 deploy/certs
sudo chmod 700 deploy/certs
sudo chmod 600 deploy/certs/fullchain.pem deploy/certs/privkey.pem
```

Set `CADDY_CONFIG_FILE=./Caddyfile.https`, `PUBLIC_HOSTNAME=<ddns-hostname>` and `APP_PUBLIC_BASE_URL=https://<ddns-hostname>:4443`, then deploy. `Caddyfile.https` loads supplied certificates; it does not obtain or renew them. After external renewal, restart only web to load the new files:

```sh
sudo docker compose --env-file deploy/.env -f deploy/compose.yml restart web
```

The default `Caddyfile` serves the private HTTP origin only. Publishing port 4443 without selecting the HTTPS configuration and providing valid certificates does not create a public HTTPS service. Do not expose the private HTTP origin as a replacement for HTTPS login.

## 6. Funnel fallback and email

After checking your Tailscale account policy and installation, expose the loopback origin through Funnel using the supported command for that installation ([official guide](https://tailscale.com/docs/features/tailscale-funnel)), commonly:

```sh
tailscale funnel --bg --https=8443 http://127.0.0.1:18081
tailscale funnel status
```

Funnel is a public HTTPS route; ordinary tailnet access or Serve alone is private. Visitors do not need Tailscale. Provide both the primary and fallback links during private deployment handover; a visitor unable to open the primary cannot use a button placed only on that page. Host-only cookies require signing in again after switching hostnames. Set `APP_PUBLIC_BASE_URL` to an entry that is verified reachable by recipients. While primary IPv6 ingress is pending, use the verified Funnel origin as the mail primary and leave `APP_PUBLIC_BACKUP_BASE_URL` empty. After both entries are verified, the IPv6 origin can be primary with Funnel as the optional backup. Verification and password-recovery emails then include both links so IPv4-only recipients can use the backup. Leaving the optional backup empty preserves a single primary link. Both links refer to the same one-use token; completing the action through either consumes it. Never build these links from an arbitrary request Host header.

To enable production email, set `APP_MAIL_ENABLED=true`, `APP_MAIL_FROM` and the provider settings `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS` and `SMTP_SSL`. Port 587 generally uses STARTTLS; port 465 generally uses implicit TLS. Follow the provider requirements and do not enable both modes. Verify application-generated confirmation, recovery and lending messages in a controlled recipient mailbox. Record configuration, SMTP acceptance and actual receipt separately; a healthy API or accepted transport self-test does not establish complete application delivery. The repository environment example disables mail by default.

The [production email guide](production-mail.md) includes the QQ SMTP example, private configuration and API-only recreation steps.

## 7. HTTP smoke and feature acceptance

Read-only anonymous checks:

```sh
python3 deploy/scripts/smoke.py --base-url http://localhost:8080
```

For the authenticated check, privately set `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `SMOKE_ADMIN_EMAIL`, and `SMOKE_ADMIN_PASSWORD` in your environment, then run:

```sh
python3 deploy/scripts/smoke.py --base-url https://library.example.invalid:4443 --exercise
```

Use the direct local API when running the local profile, or a valid HTTPS public origin for production secure cookies. `--exercise` creates a uniquely named book, publishes/borrows/returns it, checks history and role separation, then archives the book and keeps its audit history. It does not delete production records. Anonymous-only success does not assert that the authenticated check ran.

Also verify reservation priority/expiry, renewal constraints, account disabling/session invalidation, publication changes, notification deduplication/retry, overdue amount boundaries, upload/CSV errors, fresh deployment persistence, and the full reader/admin UI. CSV required headers are `title,author,category`; optional headers are `isbn,description`. Preview before importing and resolve every invalid row.

## 8. Backup, updates and rollback

Before an update:

```sh
sudo ./deploy/scripts/backup.sh
```

The backup contains a PostgreSQL custom-format dump, media archive, image inventory, deployment environment and any supplied certificate files. It uses private directory permissions and writes completed database/media files only after successful commands. Store it securely off the NAS as well, and test restore on an isolated database before relying on it. Media copied while uploads are changing is not an application-wide atomic snapshot; use a maintenance window when a consistent point-in-time copy is required.

For restore acceptance, restore the dump into an isolated database, compare expected catalog and business records, and verify extracted media through the application. Listing a media archive establishes readability only. Separately verify that database and media persist across container recreation, and record the results privately.

To update, retain the previous environment/image references, choose a verified new pair of digests and run the deployment script. Rolling back an image does not undo database migrations. Only roll back to an application compatible with the current schema, or perform an explicitly planned restore; do not blindly downgrade the database or discard volumes.

## 9. External acceptance and handover

Verify the primary from a genuine external IPv6 network and Funnel from an IPv4-only network. Check trusted TLS, exact `/healthz` responses, desktop/mobile pages, login and secure cookies, CSRF borrow/return and role permissions. Verify continued operation after DDNS address changes and certificate renewal.

Use the [NAS validation scope](nas-validation.md) to record passed, unexecuted or failed checks. Operators deliver deployment URLs and test accounts privately; raw network-probe results and operational logs stay outside the public repository. Accept the SMTP transport self-check separately from end-to-end receipt of application-generated messages.
