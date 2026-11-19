# Deployment validation

English | [简体中文](nas-validation.zh-CN.md)

This record describes the verified deployment scope without publishing operator identities, addresses, private host configuration or operational logs. Obtain current access details privately from the deployment operator. Results below are recorded evidence, not continuous availability guarantees.

## Artifact provenance

The sanitized source equivalent of the validated Web artifact is [`8e5bb2234ae0b4952f8d7d011880b1ee83c417d3`](https://github.com/G-GortoN/e-library-service/commit/8e5bb2234ae0b4952f8d7d011880b1ee83c417d3). The corresponding sanitized API source is [`d9d0529d2edbb81cb1f78aaa713b2d7b02812b9d`](https://github.com/G-GortoN/e-library-service/commit/d9d0529d2edbb81cb1f78aaa713b2d7b02812b9d). These commits preserve the original application files; CI and image tags retain their build-time identifiers, as explained in the [release record](release-record.md). Publication of a newer image does not automatically promote it into a deployment.

[CI run 44436983590](https://github.com/G-GortoN/e-library-service/actions/runs/44436983590) passed 16 backend tests, seven frontend tests, type/build checks, deployment configuration validation and real three-container smoke checks for the bilingual source. Immutable artifact references are in the [release record](release-record.md).

## Acceptance matrix

| Area | Result | Scope and limits |
| --- | --- | --- |
| Services | Passed | Web, API and PostgreSQL started and became healthy |
| Bilingual Web artifact | Passed | Served index, preloaded modules and CSS matched container-file hashes; language markers verified |
| HTTPS | Passed | Trusted production certificate and hostname matching, without bypassing TLS verification |
| Sessions and permissions | Passed | HTTPS sessions, CSRF, role isolation, create/publish/borrow/duplicate/return/history lifecycle |
| Persistence | Passed | Database records and media retained after application container recreation |
| Database backup/restore | Passed | Custom-format dump restored into a separate temporary database and catalog contents checked |
| Media archive | Partial | Archive listing and retention passed; complete media restoration not verified |
| DDNS | Passed | Record resolution and address-update configuration checked |
| Certificate maintenance | Partial | Scheduled renewal check, certificate installation and Web restart hook tested; a future scheduled renewal is not yet due |
| Deployed browser | Passed | Desktop/mobile catalog, secure session cookies, borrowing/return and reader administration denial; no page script errors |
| Public HTTPS fallback | Passed | Independent IPv4 health checks returned HTTP 200 and exact `ok`, with trusted TLS and hostname matching |
| Public authenticated browser | Passed | Browser through the public edge completed login, borrowing, CSRF return and reader administration denial; verification loan returned |
| Public bilingual browser | Passed | Chinese/English switching, refresh persistence and validation-label switching with input preserved; English 1440/390 px without overflow or script errors; anonymous checks |
| Public IPv6 primary | Pending | External TCP reachability acceptance incomplete; local reachability does not establish Internet reachability |
| SMTP transport/self-test | Passed | TLS authentication, SMTP-client self-test submission and operator-confirmed mailbox receipt |
| Application production mail | Pending | JavaMail registration, password recovery and lending-notification inbox acceptance not yet recorded |

The bilingual browser checks through the public entry were anonymous. Authenticated reader/admin regression of the bilingual interface was checked locally against the real API. These are separate evidence scopes.

## Reproducing validation

Use the [runbook](runbook.md) for configured deployment and smoke commands. Example base URLs must be replaced locally:

```sh
python3 deploy/scripts/smoke.py --base-url https://library.example.invalid
```

The default smoke check reads catalog and health-related endpoints. Authenticated exercises create persistent audit/lending records and a verification book, then return the loan and archive the book. Use dedicated test identities and controlled mail routing before enabling that mode.

Check each chosen public entry separately for trusted TLS, exact health response, static assets, cookies/CSRF and application behavior. DDNS changes do not update host firewall rules. Keep external probe targets, measurement identifiers, host logs and private deployment configuration in a private operator record.

For mail, distinguish successful SMTP transport from the application's actual JavaMail workflow. Test registration verification, password recovery and lending notifications with an operator-controlled mailbox. API health alone does not prove mail delivery. See [production email](production-mail.md).

This public record intentionally omits environment-specific hostnames, account details, secret values and detailed deployment chronology. Private configuration and backups must be access-restricted outside the repository.
