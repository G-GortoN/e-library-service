# API guide

English | [简体中文](api-guide.zh-CN.md)

The API prefix is `/api/v1`. Interactive documentation is served at `/api/docs`, and the machine-readable contract at `/api/openapi`. These paths use the same public origin as the application. See the [runbook](runbook.md) for configuration and the [implementation plan](implementation-plan.md) for business rules. Runtime verification is recorded separately in the project README.

## Authentication and errors

Authentication uses an HTTP-only session cookie. Before an unsafe request, fetch `GET /api/v1/auth/csrf` with the same cookie jar. Its response is `{ "token": "…", "headerName": "X-CSRF-TOKEN" }`; send the returned token in that header. Fetch a fresh token after login or logout. All browser requests include credentials. Never send a reader ID to choose whose account performs a borrowing operation.

Login accepts `{ "email": "reader@example.invalid", "password": "<account-password>" }` and returns the current User. Use an account created for your environment; keep all credentials outside public documentation. Registration and reset requests return a generic accepted message. Real email flows require SMTP; unavailable delivery configuration returns 503 rather than pretending to send mail.

If an enabled address is registered again before verification, old verification links are revoked and the mailbox receives a password-recovery link instead. The mailbox owner must set a new password through that link before the account becomes verified. The repeated request does not replace the stored password, and disabled accounts receive no new setup token. This prevents a second verification email from activating somebody else's preregistration password.

Errors use `application/problem+json` with `status`, `title`, `detail`, and a stable `code`. Typical statuses are 400 for invalid input, 401 for missing/expired authentication, 403 for missing permissions or CSRF, 404 for missing or another reader's resource, 409 for a business conflict, 413 for request size, 429 for rate limiting, and 503 for unavailable email or media storage. A successful return or cancellation can have an empty 204 response; do not parse it as JSON. Do not automatically replay failed write requests.

## Response shapes

IDs are JSON numbers; timestamps are ISO 8601 instants, with nullable fields where appropriate. Pagination is zero-based: `{ "items": [], "total": 0, "page": 0, "size": 20 }`. Page sizes are 1–100. Monetary amounts use integer minor units and are demonstration balances, not payments.

| Model | Fields |
| --- | --- |
| User | `id`, `email`, `displayName`, `role`, `enabled`, `emailVerified` |
| Book | `id`, `title`, `author`, `isbn`, `description`, `category`, `coverUrl`, `status`, `available`, `borrowCount`, `publishedAt` |
| Loan | `id`, `bookId`, `title`, `author`, `coverUrl`, `borrowedAt`, `dueAt`, `returnedAt`, `renewalCount`, `fineAmountMinor` |
| Reservation | `id`, `bookId`, `title`, `coverUrl`, `status`, `position`, `createdAt`, `expiresAt` |
| Notification | `id`, `title`, `body`, `type`, `read`, `createdAt` |
| Fine | `id`, `loanId`, `bookTitle`, `amountMinor`, `waivedMinor`, `status`, `createdAt` |
| Administrative projections | Loan, Reservation, and Fine list entries additionally include `readerId`, `readerName`, `readerEmail`; reader-facing responses omit these administrative additions |
| Audit | `id`, `actor`, `action`, `target`, `detail`, `createdAt` |
| Statistics | `books`, `users`, `activeLoans`, `overdueLoans`, `reservations`, `outstandingFineMinor` |

Book states are `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `ARCHIVED`; role values are `READER`, `ADMIN`. Reservation states are `WAITING`, `READY`, `CLAIMED`, `CANCELLED`, `EXPIRED`. Availability is a snapshot, not a guarantee that a subsequent borrow will succeed. READY reservations have priority.

## Public and account routes

Paths in the following tables are relative to `/api/v1`.

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/health` | Lightweight UP response; `/actuator/health` also checks application health |
| GET | `/auth/csrf` | CSRF token and header name |
| GET | `/auth/me` | Current User, or 401 |
| POST | `/auth/login` | `{email,password}` → User |
| POST | `/auth/logout` | Invalidate session → 204 |
| POST | `/auth/register` | `{email,displayName,password}` → 202 |
| POST | `/auth/verify-email` | `{token}` → confirmation message |
| POST | `/auth/password-reset-requests` | `{email}` → 202 |
| POST | `/auth/password-resets` | `{token,password}` → 204; invalidate previous sessions |
| PATCH | `/me` | `{displayName}` → User |
| POST | `/me/password` | `{currentPassword,newPassword}` → 204; sign in again |
| GET | `/books` | `q`, `category`, `availableOnly`, `page`, `size` → Page<Book> |
| GET | `/books/{id}` | Published book; owners may access a book connected to their loan history |
| GET | `/categories` | Published catalog categories as a string array |
| GET | `/recommendations` | Book array, with a cold-start fallback |
| GET | `/media/{name}` | Sanitized cover PNG, using the returned `coverUrl` |

## Reader routes

All operations are scoped to the authenticated reader. Only administrators can use separate administrative operations on another account.

| Method | Path | Input / result |
| --- | --- | --- |
| POST | `/loans` | `{bookId}` → 201 Loan |
| GET | `/me/loans` | Active Loan array; `history=true` selects returned loans |
| GET | `/me/loans/history` | Returned Loan array |
| PUT | `/loans/{id}/return` | First and repeated successful return → 204 |
| POST | `/loans/{id}/renewals` | Eligible renewal → Loan; otherwise 409 |
| POST | `/reservations` | `{bookId}` → 201 Reservation |
| DELETE | `/reservations/{id}` | Cancel own reservation → 204 |
| GET | `/me/reservations` | Reservation array |
| GET | `/me/notifications` | Up to 100 latest notifications |
| PUT | `/notifications/{id}/read` | Mark own notification read → 204 |
| GET | `/me/fines` | Fine array, including updated open-loan estimates |

## Administrative routes

All `/admin/**` routes require ADMIN. List endpoints are paginated and support `page` and `size`. Book and user lists also support `q`; the book list accepts `category`.

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/admin/stats` | Statistics |
| GET / POST | `/admin/books` | Page<Book>; create metadata → 201 Book |
| PATCH | `/admin/books/{id}` | Complete editable metadata → Book |
| PUT | `/admin/books/{id}/status` | `{status}` → Book |
| POST | `/admin/books/{id}/cover` | Multipart `file` → Book |
| POST | `/admin/books/import` | Multipart `file`, `dryRun=true` by default → `{rows:[{row,valid,errors}],imported}` |
| GET / POST | `/admin/users` | Page<User>; `{email,displayName,password,role}` → 201 User |
| PATCH | `/admin/users/{id}` | Optional `{enabled,role,displayName}` → User |
| POST | `/admin/users/{id}/password-reset` | Request recovery email → 202 |
| GET | `/admin/loans` | Page<Loan with reader identity> |
| PUT | `/admin/loans/{id}/return` | Audited administrative return → 204 |
| GET | `/admin/reservations` | Page<Reservation with reader identity> |
| GET | `/admin/fines` | Page<Fine with reader identity> |
| POST | `/admin/fines/{id}/adjustments` | `{amountMinor,reason}` → Fine; returned-loan balances only |
| POST | `/admin/fines/{id}/settle` | Demonstration settlement → Fine; no money is transferred |
| GET | `/admin/audit` | Page<Audit> |

Book metadata contains `title`, `author`, `category`, optional `isbn` and `description`. Creation starts in DRAFT. Covers accept PNG/JPEG up to 5 MB and 4096 pixels per dimension; the server decodes and re-encodes them as PNG. Use browser FormData without manually setting its multipart Content-Type.

CSV uses strict UTF-8, optionally with a BOM, and headers `title,author,category,isbn,description`; the first three are required. The file limit is 1 MB and 200 data rows. Preview before import. With `dryRun=false`, rows are imported only when all rows pass validation. Duplicate ISBNs, or duplicate title/author combinations without ISBNs, are reported with row-level errors. Importing metadata does not publish a book.
