# Production email

English | [简体中文](production-mail.zh-CN.md)

This guide configures authenticated SMTP and separates connection checks, server acceptance and actual receipt of application-generated mail. Operators keep mailbox addresses and authorization codes in private configuration; public examples use placeholders. A transport self-check does not replace end-to-end registration, password-recovery and lending-notification acceptance.

## Choose a sender

QQ Mail is one example of an authenticated SMTP provider for a small demonstration workload. Outbound provider SMTP requires no additional mail container, inbound mail ports or purchased domain.

Get the client authorization code using [QQ Mail's official instructions](https://help.mail.qq.com/detail/106/985):

1. Sign in to QQ Mail in a desktop browser. Open the top-right avatar, then **Settings → Account and security → Security settings** (`设置 → 账号与安全 → 安全设置`).
2. Enable the **POP3/IMAP/SMTP** service.
3. Select **Generate authorization code** and complete the requested verification using your QQ password or the mobile QQ QR code.
4. Copy the 16-character code and give it a recognizable label for later management.

Use the complete sender address as the SMTP username and this client authorization code as the SMTP password. Tencent documents `smtp.qq.com` with implicit TLS port 465 in its [QQ SMTP example](https://cloud.tencent.com/document/product/583/35399).

`APP_MAIL_FROM` should be the same mailbox as `SMTP_USERNAME`, unless the provider has explicitly verified a different sending identity. The website's DDNS hostname does not itself provide a mailbox or authorize a sender address. Other providers work when they support authenticated SMTP; use their documented endpoint and client credentials.

## Configure the private NAS environment

Edit the existing `deploy/.env` on the NAS using a local, privileged terminal. Preserve all existing image pins, database settings and application secrets. Enter the authorization code only in that private configuration; do not put it in chat, GitHub, screenshots or command-line arguments.

For QQ Mail on implicit TLS port 465, replace every placeholder below:

```dotenv
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USERNAME=replace-with-full-sender-address
SMTP_PASSWORD='replace-with-client-authorization-code'
SMTP_AUTH=true
SMTP_STARTTLS=false
SMTP_SSL=true
APP_MAIL_FROM=replace-with-the-same-sender-address
APP_MAIL_ENABLED=true
```

Single quotes in the dotenv file keep characters such as `$` literal. Use the provider's authorization code, not its normal website login password.

The two transport modes are alternatives:

| Provider's mode | `SMTP_PORT` | `SMTP_SSL` | `SMTP_STARTTLS` |
| --- | --- | --- | --- |
| Implicit TLS | 465 | `true` | `false` |
| STARTTLS, if supported by the provider | 587 | `false` | `true` |

Do not enable both modes. [Google's SMTP protocol documentation](https://developers.google.com/workspace/gmail/imap/imap-smtp) also describes the distinction; do not assume every provider supports both ports.

Use an HTTPS address independently verified to be reachable by recipients for account links. Replace this fictional placeholder with the chosen primary URL:

```dotenv
APP_PUBLIC_BASE_URL=https://library.example.invalid
APP_PUBLIC_BACKUP_BASE_URL=
```

When both IPv6 and Funnel entries pass external verification, select a primary and optionally set the other as `APP_PUBLIC_BACKUP_BASE_URL`. These trusted URLs control links in verification/recovery emails; they do not change the Web listener or DNS. If both are configured, either link consumes the same one-use token.

From the NAS project directory, protect the file and recreate **only the API** so the updated environment is loaded:

```sh
sudo chmod 600 deploy/.env
sudo docker compose --env-file deploy/.env -f deploy/compose.yml \
  up -d --no-deps --wait --wait-timeout 180 api
```

An ordinary `docker compose restart api` does not load changed environment values. Keep SMTP configuration outside version control; do not print the resolved Compose configuration because it contains secrets. Outbound TCP access to the provider's SMTP port is required; no additional inbound router rule is needed for sending.

## Verify delivery

Run the following application-level checks for each deployment. Use recipient addresses that you control or whose owners have agreed to receive test messages:

1. Register a fresh test reader through the public site. Check the real inbox and spam folder, open the verification link, verify the address and sign in.
2. Request a password reset for that test account. Open the real email, set a new password, and confirm the old password/session no longer works.
3. Borrow and return a book with that account. Confirm both the in-app notice and the email arrive; return the test loan when finished.

The delivery job normally runs every 15 seconds and retries failed sends up to five attempts with delays. A registration/reset response, a queued message, or healthy containers do not prove receipt. Enabling mail does not retroactively email notifications created while mail was disabled.

If authentication fails, check SMTP service activation, the complete username, a current authorization code, sender identity and the selected TLS mode. If connections time out, check outbound DNS/TCP from the NAS. For missing mail, check spam and the provider's sending policy. Inspect delivery status privately without exposing bodies, links or credentials. If configuration cannot be completed, restore `APP_MAIL_ENABLED=false` and recreate the API; administrator-created accounts and in-app notifications remain usable.

See the [runbook](runbook.md) for the rest of the deployment and the [NAS validation scope](nas-validation.md) for acceptance criteria and record keeping.
