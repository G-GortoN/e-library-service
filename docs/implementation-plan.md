# Implementation Plan

English | [简体中文](implementation-plan.zh-CN.md)

Public delivery evidence: [CI run 44436983590](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) passed 16 backend tests, seven frontend tests, type checking and builds, Compose/Caddy checks, image publication and actual container smoke checks for the bilingual application source. The complete feature scope and acceptance criteria follow. Each target deployment still requires separate public-entry and application-email verification. Deployment addresses, credentials, network topology and operational logs remain in private configuration and records.

## Delivery scope

All core and selected extension features are included. Milestones define dependency order, not optional scope.

| ID | Capability | Acceptance |
| --- | --- | --- |
| F01 | Browse books | Paginated, stable catalog with availability and complete loading/empty/error states |
| F02 | View details | Published book details and a clear borrow or reservation action; missing resources return 404 |
| F03 | Borrow | Server-derived reader identity, transactional validation, and no concurrent over-allocation |
| F04 | Return | Owner-only operation; repeated returns succeed without duplicate state changes |
| F05 | Current loans | Only the authenticated reader's active loans |
| F06 | Error handling | Validation and consistent HTTP problem responses with stable business codes |
| F07 | Demonstration data | Repeatable seed catalog and reader accounts without duplicate inserts |
| F08 | Business verification | Meaningful integration tests for concurrency, permissions, lifecycle, and background work |
| F09 | Documentation | Reproducible build, run, test, configuration, deployment, and trade-off documentation in English and Simplified Chinese |
| F10 | Authentication | Session sign-in/out, server-controlled identity, and account-state checks |
| F11 | Separate frontend | Independently built SPA, responsive reader/admin flows, and complete Chinese/English interface switching with saved preference |
| F12 | GitHub maintenance | Incremental commits, working CI, and traceable release artifacts |
| F13 | NAS containers | Persistent data, health/readiness checks, restart behavior, backups, and verified deployment |
| F14 | Public access | Verified IPv6 HTTPS primary and publicly reachable Funnel backup |
| F15 | Search | Title/author search, category and availability filters, stable pagination |
| F16 | Loan history | Reader-owned history distinct from active loans |
| F17 | API documentation | OpenAPI matches the implementation; interactive requests retain authorization and CSRF checks |
| F19 | Accounts and administration | Registration, recovery, book creation/editing/import, publication lifecycle, and account management |
| F20 | Lending extensions | Reservations, renewals, reminders, demonstration overdue accounts, and rule-based recommendations |

F18, an online content reader and a separate periodical model, is excluded. Cover uploads and CSV catalog imports are included. Full PDF/EPUB file storage or distribution is not implicitly included and must be resolved separately before claiming that capability.

## Proposed configurable defaults

These are product assumptions for the demonstration, not externally mandated lending or charging policies.

| Rule | Initial default |
| --- | --- |
| Concurrent licenses | One per book |
| Loan term | 14 days |
| Active loan limit | Five per reader |
| Renewals | One extension of seven days, calculated from the existing due date |
| Reservation order | FIFO, ordered by creation time and ID |
| Collection window | 48 hours from READY status and creation of the in-app notice |
| Demonstration overdue amount | 10 minor currency units per completed overdue 24-hour period |
| Per-loan amount cap | 1,000 minor currency units |
| Notification schedule | One day before due, first overdue event, and reservation ready/expired/cancelled events |

All times are stored as instants and displayed in the selected UI time zone. Overdue loans are not automatically returned. A return releases the license and freezes the calculated overdue amount. No payment processor or real debit is part of the scope.

## Domain and lifecycle

Use a modular monolith organized around catalog, identity, lending, reservations, notifications, and demonstration billing. Use DTOs for API contracts and explicit service transaction boundaries.

Core models will include Book, User, Loan, Reservation, Notification/Delivery, AccountToken, Fine/Adjustment, and AuditLog. Classification data supports catalog filtering and recommendations.

- Book publication state is distinct from license availability: DRAFT, PUBLISHED, UNPUBLISHED, and ARCHIVED.
- Unpublishing prevents new borrowing, renewal, and reservation. It cancels pending reservations and produces notices while preserving existing loans, returns, and history. Republishing does not revive cancelled reservations.
- A disabled user cannot retain usable sessions or make new lending operations. Active reservations are cancelled and the queue advances. Administrators may return existing loans on the user's behalf, with an audit record.
- Administrative account and role changes must not remove the last enabled administrator.
- Recommendations use category preferences, borrowing popularity, and recently published titles. They exclude unpublished books and the reader's active loans, with a sensible cold-start fallback.

## Concurrency and consistency

The database must enforce at most one active loan per book. An active-loan unique constraint alone does not protect reservation priority or a reader's active-loan limit.

Borrowing, returning, reservation assignment/expiry, renewal, and unpublishing must use reviewed transaction boundaries and a consistent locking strategy. READY reservations reserve the license for their owner; a direct borrower cannot skip the queue. Additional uniqueness rules prevent duplicate active reservations.

Returning is idempotent and retains its original return timestamp. Concurrent duplicate renewals must not extend the due date or count more than once. Notification creation and delivery must be recoverable and deduplicated; a rolled-back operation must not emit a successful external notification.

## Identity, administration, and email

Roles are READER and ADMIN. Frontend navigation is only presentation: all sensitive operations require backend authorization. Reader-owned resources are resolved from the authenticated principal, not a supplied user ID.

Account registration, verification, recovery, and password changes need validation and rate limits. Recovery requests return a uniform response; recovery tokens are hashed, expiring, and single-use. Resetting a password invalidates old sessions. Administrator write credentials are injected at deployment and never published as demo credentials.

Book administration includes metadata and category editing, publication transitions, constrained cover-image uploads, and CSV import preview with row-level errors. Cover files live in a dedicated persistent media directory. Existing historical records are not deleted when a book or account is deactivated.

In-app notifications are required. SMTP supports verification/recovery and lending notifications. A development mail capture service may be used for local tests; production email flows require real configuration and delivery verification. Pending delivery state and retries are stored in PostgreSQL, so a separate broker is unnecessary at this scale.

Demonstration overdue balances use fixed-point/minor-unit arithmetic and explain their calculation. Administrative waivers and demonstration settlement are audited. They do not represent real payments.

## Frontend direction

The reader experience will use a warm off-white background, deep green primary color, restrained terracotta accents, book-cover grids, generous spacing, and readable Chinese/English typography. The administration console will share the theme while using clear navigation, status labels, tables, and editing drawers.

Reader routes cover the catalog, details, personal shelf, reservations, loan history, account flows, notifications, and demonstration balances. Administration routes cover summary metrics, book/import/publication management, users and roles, lending/reservations, balances, and audit history.

Use shared design tokens and components, route-based loading, keyboard-visible focus, labelled forms, and responsive layouts. Verify long titles, missing covers, empty data, submission feedback, and errors. Visual acceptance requires reviewing actual pages; installing a component library is not sufficient evidence.

The complete reader and administration interfaces support Chinese/English switching, including forms, validation, errors, confirmations, dates and amounts. Language preference persists in the browser; catalog content keeps its original language. Local real-API browser checks covered both languages and saved preference. English catalog layouts at 320/390/768/1440 px, all seven admin routes, mobile admin tables/forms at 390 px, language switching and existing validation errors, and authenticated reader borrow/return passed against the real local API, with no horizontal overflow or page script errors.

## Public deployment

The runtime target is three application services: Caddy/static frontend, Spring Boot API, and PostgreSQL. Media, database, and certificate data are persistent. Build and test work runs on the development host or CI rather than the NAS.

Primary access uses an IPv6-capable DDNS hostname and a routable NAS IPv6 address. Validate the assigned address, inbound reachability, IPv6 firewall policy, listener configuration, address changes, DDNS updates, and ACME certificate issuance. Do not publish the database, Docker API, or NAS management interface.

Funnel is a public backup pointing to the same Web service. Provide both verified links privately during deployment handover; IPv4-only visitors need the backup. Use separate host-only secure cookies per hostname. Verification/recovery links must use a configured trusted public base URL rather than an unvalidated Host header.

The successful [CI run](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) verified the backend, frontend and Compose/Caddy configuration, published both API/Web `linux/amd64` images to GHCR, and passed `container-smoke`. That job verified healthy Web/API/PostgreSQL containers, Web/API UID 10001, persistent-volume writes, read-only application filesystems, SPA/deep-link/built-JavaScript delivery, and the Web-proxied login/CSRF/permissions/publication/borrow/return/history flow. Anonymous manifest reads for both published packages returned HTTP 200. Its test-only `APP_COOKIE_SECURE=false` override supports ephemeral loopback HTTP; production secure-cookie defaults remain unchanged.

## Milestones

1. Establish executable backend/frontend skeletons, compatible pinned versions, and local database migrations.
2. Complete the core browse/detail/borrow/return/current-loan path and database concurrency tests.
3. Add account lifecycle, backend roles, book publication/import/upload, and account administration.
4. Add loan periods, reservations, renewal, notifications, demonstration balances, and recommendations.
5. Complete reader/admin pages and review visual and accessibility states using real interactions.
6. Add working CI, versioned images, Compose, persistence, backup/recovery, and restart verification.
7. Inspect the target NAS and configure the IPv6/DDNS/HTTPS primary and Funnel backup.
8. Complete end-to-end public acceptance and publish accurate runbooks/release notes; verify application JavaMail registration/recovery/lending-email end-to-end flows separately.

## Verification gates

- Two users racing for one license produce exactly one active loan; reservations cannot be bypassed.
- Duplicate borrow, return, renewal, and background-task execution preserve their defined state and amounts.
- Another reader's loans, notifications, reservations, and balances remain private.
- Unpublishing and disabling accounts preserve history and permit audited resolution of existing loans.
- Reservation expiry advances the queue correctly; notification failure/restart does not lose state or duplicate events.
- Email tokens expire and cannot be replayed; real recovery mail reaches its recipient through configured SMTP.
- Imported rows and uploaded files are validated, and persistent files survive service replacement.
- A fresh documented environment can build and run the application, and retained volumes preserve business data after container replacement.
- A real external IPv6 network can use the primary link; an IPv4-only network can use the backup.
- Reader and administrator workflows, visual states, API documentation, and authorization behavior match the release notes.

## Deployment acceptance and scope boundaries

The public repository is [G-GortoN/e-library-service](https://github.com/G-GortoN/e-library-service). Use the [NAS validation scope](nas-validation.md) and [runbook](runbook.md) to check target image digests, persistence, isolated restore, external IPv6/Funnel access and application JavaMail end-to-end flows. Mark only executed checks as passed; CI and an SMTP transport self-check do not replace production and business-email acceptance. Full book-file storage requires separate scope agreement and is not a delivered feature.
