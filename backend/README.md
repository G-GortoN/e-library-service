# Backend

English | [简体中文](README.zh-CN.md)

Java 21, Spring Boot 4, Spring MVC/Security, JPA, PostgreSQL, Flyway and OpenAPI. The backend source includes the catalog, account lifecycle, lending, reservations, notifications, administration and demonstration billing. Runtime verification is tracked in the project release notes and CI; source presence alone does not establish a successful deployment.

## Run locally

Install Java 21 and start a dedicated PostgreSQL 17 database. From this directory:

```sh
export DATABASE_URL=jdbc:postgresql://localhost:5432/elibrary
export DATABASE_USERNAME=elibrary
export DATABASE_PASSWORD='your-local-database-password'
export SPRING_PROFILES_ACTIVE=local
./mvnw spring-boot:run
```

The service listens on port 8080. The `local` profile permits HTTP cookies, seeds synthetic sample data, and enables delivery to a local SMTP capture service on port 1025. Set your own administrator credentials and create a local reader through the administration workspace. Keep development fixtures confined to isolated environments. Seed data is only allowed with the `local` or `demo` profile; normal production startup does not create it.

For administrator bootstrap set **both** `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD` before startup. No default administrator password is shipped. Existing administrator credentials are not reset on restart. Production must use HTTPS and `APP_COOKIE_SECURE=true`.

## API and configuration

- OpenAPI JSON: `/api/openapi`; Swagger UI: `/api/docs`.
- Health: `/actuator/health` or `/api/v1/health`.
- Forwarded headers use Tomcat's native handling with its default internal/loopback proxy trust. Keep the API on the private container network and make Caddy replace untrusted forwarding headers. Verify the Funnel proxy chain before extending trust; never trust arbitrary client `X-Forwarded-For`.
- Fetch `GET /api/v1/auth/csrf`, send its `token` using the returned `headerName` on writes, and fetch a new token after login/logout. Login accepts JSON `{email,password}`. Cookies hold the session; roles and account state are checked server-side.
- `APP_PUBLIC_BASE_URL` is the trusted frontend address for verification/reset links. Optional `APP_PUBLIC_BACKUP_BASE_URL` defaults to empty. When configured with a different address, verification and recovery emails also include a backup link using the same single-use token, so recipients without IPv6 can use the Funnel entry point. Both addresses must be absolute HTTP(S) URLs without credentials, query or fragment; neither is derived from request headers. Using either link consumes the token for both.
- Registering an already pending, enabled address revokes its old verification links and sends password recovery instead. The mailbox owner must choose a new password; neither the original preregistration password nor the repeated form's password is silently activated. Disabled accounts receive no new setup token. Registration responses remain generic for all account states.
- `APP_MAIL_ENABLED=true` and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS`, `APP_MAIL_FROM` configure delivery. Missing mail configuration rejects registration/recovery with 503 instead of claiming delivery. SMTP failure does not make catalog health fail.
- `APP_MEDIA_DIRECTORY` controls the persistent cover directory. Cover uploads accept PNG/JPEG up to 5 MB and 4096 pixels per side; images are re-encoded. CSV imports accept UTF-8 files up to 1 MB and 200 rows, with `title,author,category` and optional `isbn,description` headers. Preview errors before import; imports are all-or-nothing.
- Lending rules use `APP_LOAN_DAYS`, `APP_MAX_ACTIVE_LOANS`, `APP_RENEWAL_DAYS`, `APP_MAX_RENEWALS`, `APP_RESERVATION_HOURS`, `APP_FINE_RATE_MINOR`, and `APP_FINE_CAP_MINOR`.

## Transactions and scheduled work

Flyway owns the schema; Hibernate validates it. A partial unique index prevents concurrent active loans of the same book. JPA loads the catalog aggregate; JDBC projections include live availability without per-book round trips. Transactional SQL updates keep the lifecycle explicit.

All domain writers acquire the same PostgreSQL transaction advisory lock. This deliberately serializes writes across application processes, simplifying the joint invariants for loan limits, FIFO reservations, book publication and the last enabled administrator. It favors correctness over high write throughput on a small NAS. A larger deployment should move to carefully ordered aggregate locks; the database constraints and integration tests remain necessary.

Reservation expiry and due reminders run every minute; persisted email delivery runs every 15 seconds. Notifications are deduplicated by business event. SMTP attempts use bounded exponential retry, with failed deliveries retained after five attempts. Successful token email bodies are redacted; expired token bodies are cleaned after one day. SMTP cannot guarantee exactly-once delivery when a process fails after sending but before committing.

Overdue amounts use whole 24-hour periods and integer minor units, are capped, and freeze at return. Adjustment and demonstration settlement require the book to have been returned. No real payment is processed.

## Verify

```sh
./mvnw verify
```

By default tests start PostgreSQL 17 using Testcontainers, requiring a Docker-compatible runtime. To use an existing **disposable test database**, set `ELIB_TEST_DATABASE_URL`, `ELIB_TEST_DATABASE_USERNAME`, and `ELIB_TEST_DATABASE_PASSWORD`. Tests truncate all application tables; never point them at a real library database. Tests use an adjustable clock and cover HTTP authentication/CSRF, concurrent borrowing, queue priority, renewal and limits, unpublishing, disabled sessions, token replay, fines and email retry.

See the [implementation plan](../docs/implementation-plan.md) and [deployment guide](../deploy/README.md).
