# Frontend

English | [简体中文](README.zh-CN.md)

Folio is a React single-page application containing a reader experience and an administrator workspace. Both the interface and project documentation support Simplified Chinese and English.

## Interface languages

Use the globe button in the reader header or administrator toolbar to switch languages. The initial language follows the browser, with Simplified Chinese as the fallback; an explicit choice is saved locally and survives refreshes. Switching keeps the current route, signed-in session and form input. Existing validation messages, system notifications, statuses, dates, number formatting and Ant Design controls follow the selected language. Currency remains CNY. Book titles, authors, descriptions, categories and user content retain their original text.

Translations use i18next/react-i18next in `src/locales/`, grouped into common, reader, authentication and administration namespaces. Add both language entries together. Tests check translation coverage, interpolation arguments, English plurals and localization of cached API messages alongside transport/CSRF behavior.

## Development

Use a maintained Node.js release compatible with Vite (Node 22.12 or later). Install the exact dependency tree and start the local development server:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` and `/media` to `http://localhost:8080`. Start the backend separately; the frontend uses real API responses and does not substitute mock books or a fake successful login. To change the backend target:

```sh
VITE_API_PROXY=http://127.0.0.1:8080 npm run dev
```

## Build and verification

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The build runs strict TypeScript checking before producing `dist/`. Route modules are loaded separately, including the administration console. Production serves these static assets through Caddy with same-origin API proxying; there is no persistent Node.js application server. `npm run preview` only previews static output and does not replace the production API reverse proxy.

The implementation uses React 19, TypeScript 7, Vite 8, React Router 7, TanStack Query 5, Ant Design 6, i18next 27 and react-i18next 18. Versions are pinned in `package.json` and `package-lock.json`. Source formatting uses Prettier.

## Pages and behavior

- Catalog, search, category/availability filters, pagination, recommendations, and book details.
- Current loans, owner-only return, renewal, loan history, reservations, cancellation, and collection.
- Registration, verification links, sign-in/out, recovery/reset links, profile, and password changes.
- In-app notifications, read state, and demonstration overdue balances.
- Administrator overview, book editing/publication/archive, cover upload, CSV validation/import, account roles/status, lending and reservation records, audited demonstration balance adjustment/settlement, and audit history.

Generated text covers use local CSS rather than third-party imagery. Uploaded covers come from the backend. Loading, empty, failure, permission, and missing-page states are included; reader layouts adapt to mobile screens, and administrative tables scroll on narrow screens.

Requests use Session cookies and CSRF headers. The client refreshes CSRF after login, never supplies a reader ID for ownership, and does not automatically retry writes. Protected routes are presentation only: the backend remains responsible for all authorization and lending rules.

## Demo and email setup

Development builds can show controls for synthetic local/demo fixtures. Use administrator-created accounts and locally chosen credentials for acceptance. Fixture autofill controls are hidden in production by default; `VITE_DEMO_MODE=true` is only for an explicitly isolated demonstration build. Values in `VITE_*` become public client code and must not contain private credentials.

Registration asks the mailbox holder to check account-confirmation mail and follow its instructions to verify the email address or set a password. Email links use `/verify-email?token=…` and `/reset-password?token=…`. Actual verification and recovery require the backend's configured mail transport. A successful frontend build alone does not prove end-to-end SMTP, backend integration, or NAS deployment; those are verified in the project delivery workflow.

The complete rules and delivery gates are in the [implementation plan](../docs/implementation-plan.md).

See [production email configuration](../docs/production-mail.md) for provider settings and real inbox checks. Record environment-specific acceptance results privately.

Dependency check: no runtime dependency vulnerabilities were reported. The build toolchain transitively uses picomatch, which has an [unpatched ReDoS advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf); the full development audit reports five related high-severity entries. Vite is used only for local development/building, while the NAS runtime contains Caddy and static assets.
