# API 使用指南

[English](api-guide.md) | 简体中文

API 前缀为 `/api/v1`。交互文档入口为 `/api/docs`，机器可读契约为 `/api/openapi`，均与应用使用同一公网源。配置方式见[运维手册](runbook.zh-CN.md)，业务规则见[实施计划](implementation-plan.zh-CN.md)。运行验证情况单独记录在项目 README 中。

## 认证与错误

认证使用 HTTP-only 会话 Cookie。执行写请求前，先携带同一份 Cookie 请求 `GET /api/v1/auth/csrf`，返回 `{ "token": "…", "headerName": "X-CSRF-TOKEN" }`；将令牌放入返回的请求头。登录或退出后重新获取令牌。浏览器请求均携带凭据。借阅操作不接受客户端指定读者 ID 来选择操作归属。

登录提交 `{ "email": "reader@example.invalid", "password": "<account-password>" }`，返回当前 User。请使用在目标环境中创建的账号，凭据不写入公开文档。注册和重置请求返回统一的已接受提示。真实邮件流程需要 SMTP；邮件配置不可用时返回 503，不会假装发送成功。

已启用的邮箱在验证前被重复注册时，会撤销旧验证链接，改向该邮箱发送密码恢复链接。邮箱持有人必须通过链接选择新密码后，账号才完成验证；重复注册请求不直接替换已保存密码，禁用账号不收到新设置令牌。这样可以避免第二封验证邮件激活他人预注册时留下的密码。

错误使用 `application/problem+json`，包含 `status`、`title`、`detail` 和稳定的 `code`。常见状态包括：400 输入无效、401 未登录或会话过期、403 权限或 CSRF 校验失败、404 资源不存在或不属于当前读者、409 业务冲突、413 请求过大、429 限流、503 邮件或媒体存储不可用。成功归还或取消可能返回空的 204 响应，不要解析为 JSON，也不要自动重放失败的写请求。

## 响应结构

ID 使用 JSON 数字；时间使用 ISO 8601 时间点，允许为空的字段按实际状态返回 null。分页从 0 开始：`{ "items": [], "total": 0, "page": 0, "size": 20 }`，每页数量为 1–100。金额使用整数最小货币单位，只表示演示账单，不代表付款。

| 模型 | 字段 |
| --- | --- |
| User | `id`、`email`、`displayName`、`role`、`enabled`、`emailVerified` |
| Book | `id`、`title`、`author`、`isbn`、`description`、`category`、`coverUrl`、`status`、`available`、`borrowCount`、`publishedAt` |
| Loan | `id`、`bookId`、`title`、`author`、`coverUrl`、`borrowedAt`、`dueAt`、`returnedAt`、`renewalCount`、`fineAmountMinor` |
| Reservation | `id`、`bookId`、`title`、`coverUrl`、`status`、`position`、`createdAt`、`expiresAt` |
| Notification | `id`、`title`、`body`、`type`、`read`、`createdAt` |
| Fine | `id`、`loanId`、`bookTitle`、`amountMinor`、`waivedMinor`、`status`、`createdAt` |
| 管理投影 | Loan、Reservation、Fine 的管理列表额外包含 `readerId`、`readerName`、`readerEmail`；读者接口不返回这些管理扩展字段 |
| Audit | `id`、`actor`、`action`、`target`、`detail`、`createdAt` |
| Statistics | `books`、`users`、`activeLoans`、`overdueLoans`、`reservations`、`outstandingFineMinor` |

书籍状态为 `DRAFT`、`PUBLISHED`、`UNPUBLISHED`、`ARCHIVED`；角色为 `READER`、`ADMIN`。预约状态为 `WAITING`、`READY`、`CLAIMED`、`CANCELLED`、`EXPIRED`。可借状态只是查询快照，不保证之后的借阅一定成功；READY 预约享有优先权。

## 公开与账号接口

下表中的路径均相对于 `/api/v1`。

| 方法 | 路径 | 输入与结果 |
| --- | --- | --- |
| GET | `/health` | 轻量 UP 响应；`/actuator/health` 还检查应用健康状况 |
| GET | `/auth/csrf` | CSRF 令牌与请求头名称 |
| GET | `/auth/me` | 当前 User，未登录返回 401 |
| POST | `/auth/login` | `{email,password}` → User |
| POST | `/auth/logout` | 会话失效 → 204 |
| POST | `/auth/register` | `{email,displayName,password}` → 202 |
| POST | `/auth/verify-email` | `{token}` → 确认提示 |
| POST | `/auth/password-reset-requests` | `{email}` → 202 |
| POST | `/auth/password-resets` | `{token,password}` → 204；旧会话失效 |
| PATCH | `/me` | `{displayName}` → User |
| POST | `/me/password` | `{currentPassword,newPassword}` → 204；需重新登录 |
| GET | `/books` | `q`、`category`、`availableOnly`、`page`、`size` → Page<Book> |
| GET | `/books/{id}` | 上架书目；本人可以查看与自身借阅历史关联的书籍 |
| GET | `/categories` | 已上架书目的分类字符串数组 |
| GET | `/recommendations` | Book 数组，无历史用户也有默认结果 |
| GET | `/media/{name}` | 按返回的 `coverUrl` 获取经处理的封面 PNG |

## 读者接口

所有操作归属于当前认证读者。只有管理员能通过独立管理接口处理其他账号的数据。

| 方法 | 路径 | 输入与结果 |
| --- | --- | --- |
| POST | `/loans` | `{bookId}` → 201 Loan |
| GET | `/me/loans` | 有效 Loan 数组；`history=true` 改查已归还借阅 |
| GET | `/me/loans/history` | 已归还 Loan 数组 |
| PUT | `/loans/{id}/return` | 首次和重复成功归还均返回 204 |
| POST | `/loans/{id}/renewals` | 符合条件时返回 Loan，否则 409 |
| POST | `/reservations` | `{bookId}` → 201 Reservation |
| DELETE | `/reservations/{id}` | 取消本人预约 → 204 |
| GET | `/me/reservations` | Reservation 数组 |
| GET | `/me/notifications` | 最近最多 100 条通知 |
| PUT | `/notifications/{id}/read` | 标记本人通知已读 → 204 |
| GET | `/me/fines` | Fine 数组，包含更新后的未归还借阅费用估算 |

## 管理接口

所有 `/admin/**` 路径要求 ADMIN。列表接口分页，支持 `page`、`size`；书籍和账号列表还支持 `q`，书籍列表额外支持 `category`。

| 方法 | 路径 | 输入与结果 |
| --- | --- | --- |
| GET | `/admin/stats` | Statistics |
| GET / POST | `/admin/books` | Page<Book>；创建元数据 → 201 Book |
| PATCH | `/admin/books/{id}` | 提交完整可编辑元数据 → Book |
| PUT | `/admin/books/{id}/status` | `{status}` → Book |
| POST | `/admin/books/{id}/cover` | Multipart `file` → Book |
| POST | `/admin/books/import` | Multipart `file`，默认 `dryRun=true` → `{rows:[{row,valid,errors}],imported}` |
| GET / POST | `/admin/users` | Page<User>；`{email,displayName,password,role}` → 201 User |
| PATCH | `/admin/users/{id}` | 可选的 `{enabled,role,displayName}` → User |
| POST | `/admin/users/{id}/password-reset` | 请求恢复邮件 → 202 |
| GET | `/admin/loans` | 包含读者信息的 Page<Loan> |
| PUT | `/admin/loans/{id}/return` | 带审计的管理员代归还 → 204 |
| GET | `/admin/reservations` | 包含读者信息的 Page<Reservation> |
| GET | `/admin/fines` | 包含读者信息的 Page<Fine> |
| POST | `/admin/fines/{id}/adjustments` | `{amountMinor,reason}` → Fine；只处理已归还借阅的账单 |
| POST | `/admin/fines/{id}/settle` | 演示结清 → Fine；不会发生资金转移 |
| GET | `/admin/audit` | Page<Audit> |

书籍元数据包括 `title`、`author`、`category`，以及可选的 `isbn`、`description`；创建时为 DRAFT。封面支持不超过 5 MB、单边不超过 4096 像素的 PNG/JPEG，服务端解码后重新编码为 PNG。浏览器使用 FormData，不要手动设置 multipart Content-Type。

CSV 使用严格 UTF-8，可带 BOM；表头为 `title,author,category,isbn,description`，前三列必填。文件最大 1 MB、最多 200 条数据行。先预览再导入；`dryRun=false` 时，只有全部数据行校验通过才实际导入。重复 ISBN，或无 ISBN 的同名同作者书目，会返回逐行错误。导入元数据不会自动上架。
