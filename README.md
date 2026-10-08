# BillFolder Web

Angular 22 web client for the BillFolder MVP. The application is a responsive, installable PWA:
the shell and local assets can be cached, while every `/v1` API read and write remains online-only.
Access tokens stay in application memory; browser refresh authentication uses an API-managed
`HttpOnly` cookie.

Local MVP verification was completed on 2026-10-08. This repository is ready for an explicitly
authorized preview/deployment setup, but no remote, Cloudflare project, domain, backend production
configuration, deployment, publication, or production smoke is implied by that status.

## Requirements and clean install

- Node.js **24.15.0** (pinned in `.nvmrc`)
- npm **11.12.1** (pinned by `packageManager`)

```bash
nvm install
nvm use
npm ci
```

Do not continue under Node 24.14 or another unsupported version: Angular 22.2 and this project both
enforce the newer runtime range.

## Local application runbook

The development client expects a local BillFolder API at `http://localhost:5077/v1`.

```bash
nvm use
npm start
```

Open `http://localhost:4200`. Development mode intentionally does not enable the production service
worker. Start and configure the backend separately from the `BillFolder` repository; do not place
secrets in this frontend repository.

## Clean verification runbook

```bash
nvm use
npm ci
npm run test:ci
npm run build:prod
npm run e2e
```

- `test:ci` runs the Angular unit suite and source-level PWA/security configuration tests.
- `build:prod` creates the production application and then verifies the manifest, generated Angular
  service worker, absence of API data caching, copied Cloudflare control files, CSP authorization for
  built inline scripts, and ordinary screen stylesheet loading.
- `e2e` compiles the Playwright tests, starts the Angular E2E configuration on
  `http://127.0.0.1:4200`, and runs Chromium against a strict deterministic API fixture on the
  distinct origin `http://127.0.0.1:4301`.

Fresh Task 14 evidence from 2026-10-08:

- Angular/Vitest: **337 passed in 75 files; 0 failed**.
- Static security/PWA source checks: **4 passed; 0 failed**.
- Production artifact checks: **5 passed; 0 failed**.
- Playwright E2E: **8 passed; 0 failed**.
- Production bundle: **450.72 kB raw / 116.82 kB estimated transfer** for the initial chunks.

The deterministic E2E fixture validates CORS preflights, credentials, paths, methods, query strings,
request bodies, refresh-cookie rotation, and access-token refresh without recording credential
values. The production-artifact smoke serves the built output with the real `_headers` policy and
blocks the production API before any request can leave the browser. No local or production backend,
real account, or real secret is used by `npm run e2e`.

The loopback E2E boundary is intentionally HTTP, so Chromium observes its synthetic refresh cookie
with `secure: false`. `config/web-auth-cookie-contract.json` records that test-only transport limit
and statically requires `Secure`, `HttpOnly`, `SameSite=Lax`, and path `/v1/auth/web` for HTTPS
production cookies.

Use Playwright UI mode only with the pinned Node version:

```bash
npm run e2e:ui
```

## PWA and production artifact inspection

Create and verify the deployable build with:

```bash
npm run build:prod
```

The static output is:

```text
dist/bill-folder-web/browser
```

For local service-worker and installability inspection, Angular supports serving the production
configuration on localhost:

```bash
npm run ng -- serve --configuration=production
```

Open `http://localhost:4200`, then inspect the manifest and service worker in browser developer tools.
`localhost` is the browser security exception that permits service workers without HTTPS. The
production configuration points to `https://api.billfolder.app/v1`; until production smoke is
explicitly authorized, use this command only to inspect the unauthenticated shell/PWA and do not log
in or exercise API reads/writes. See the
[Angular service-worker guide](https://angular.dev/ecosystem/service-workers/getting-started).

`public/_redirects` supplies the SPA fallback. `public/_headers` supplies the static security headers
and a CSP that permits scripts and fonts only from the application origin, permits the inline
component styles required by Angular at runtime, and restricts connections to the application origin
plus `https://api.billfolder.app`.

## Cloudflare runbook — authorization required

Only after explicit user authorization, configure Cloudflare Pages with:

- Production branch: `main`
- Build command: `npm run build:prod`
- Build output directory: `dist/bill-folder-web/browser`
- Node version: `24.15.0`

The authorized rollout order is:

1. Create or connect the approved Git remote.
2. Create the Cloudflare project and configure its build settings.
3. Configure the exact web origins in backend `WebAuth:AllowedOrigins`, then deploy the backend.
4. Connect `app.billfolder.app`, deploy the static web build, and confirm `_headers`/`_redirects`.
5. Run the separately authorized authenticated production smoke.

Without that explicit authorization, do **not** create or connect a remote, push, create a Cloudflare
project or domain, change production CORS/origins, deploy, publish, use SSH, or run production smoke
tests. Backend production changes and web publication are separate operations; local readiness does
not authorize either one.
