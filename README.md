# BillFolder Web

Angular 22 web client for the BillFolder MVP. The application is a responsive, installable PWA:
the shell and local assets can be cached, while every `/v1` API read and write remains online-only.
Access tokens stay in application memory; browser refresh authentication uses an API-managed
`HttpOnly` cookie.

The final whole-product review and its scoped re-review are complete. The two residual Important
findings were corrected locally with deterministic regressions, and all local delivery gates are
green. The authorized preview rollout has also been completed and validated. The first post-MVP
parity slice adds safe administration of cycles and checking accounts, including cross-client
protection against deleting an account that is still in use. See the binding
[final whole-product review](../BillFolder/.superpowers/sdd/2026-10-07-billfolder-web-mvp/final-whole-review.md)
and the [residual-fix report](../BillFolder/.superpowers/sdd/2026-10-07-billfolder-web-mvp/final-residual-fix-report.md).
Those reports preserve the MVP baseline; the current post-MVP verification totals and live preview
status are documented below.

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
npm run audit:ci
npm run test:ci
npm run build:prod
npm run build:preview
npm run e2e
```

- `audit:ci` fails on high or critical npm advisories. The exception process and current empty
  exception list are in `docs/security/npm-audit-exceptions.md`.
- `test:ci` enforces repository formatting, then runs the Angular unit suite and source-level
  PWA/security configuration tests.
- `build:prod` creates the production application and then verifies the manifest, generated Angular
  service worker, absence of API data caching, copied Cloudflare control files, CSP authorization for
  built inline scripts, and ordinary screen stylesheet loading.
- `e2e` compiles the Playwright tests, starts the Angular E2E configuration on
  `http://127.0.0.1:4200`, and runs Chromium against a strict deterministic API fixture on the
  distinct origin `http://127.0.0.1:4301`.

Final local evidence from 2026-10-10:

- Angular/Vitest: **511 passed; 0 failed**.
- Static security/PWA source checks: **6 passed; 0 failed**.
- Production artifact checks: **5 passed; 0 failed**.
- Production and preview builds: **passed**.
- Playwright E2E: **17 passed; 0 failed**; the CSP smoke is also independently runnable as one test.
- npm audit: **0 vulnerabilities** at the configured high-severity gate.

The authoritative exact results and bundle sizes are recorded after the clean final run in the
linked residual-fix report. These results establish local readiness, not deployment authorization.

The deterministic E2E fixture validates CORS preflights, credentials, paths, methods, query strings,
request bodies, refresh-cookie rotation, and access-token refresh without recording credential
values. The production-artifact smoke serves the built output with the real `_headers` policy and
blocks the production API before any request can leave the browser. No local or production backend,
real account, or real secret is used by `npm run e2e`.

The loopback E2E boundary is intentionally HTTP, so Chromium observes its synthetic refresh cookie
with `secure: false` and `SameSite=Lax`. That is an explicit local-fixture exception only.
`config/web-auth-cookie-contract.json` statically requires `Secure`, `HttpOnly`, `SameSite=Strict`,
and path `/v1/auth/web` for HTTPS preview and production cookies.

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

`wrangler.jsonc` supplies the Workers Static Assets directory and SPA fallback. Do not add a
catch-all `public/_redirects` rule alongside it: Workers rejects that combination as a redirect loop.
`public/_headers` supplies the static security headers and a CSP that permits scripts and fonts only
from the application origin, permits the inline component styles required by Angular at runtime, and
restricts connections to the application origin plus `https://api.billfolder.app`.

## Authenticated preview contract

The only authenticated preview origin is `https://preview.billfolder.app`, and it calls
`https://api.billfolder.app/v1`. Build it locally with:

```bash
npm run build:preview
```

The output remains `dist/bill-folder-web/browser`. The preview configuration uses the production
service worker, CSP, cookie strength, and exact API origin. Wildcard credentialed CORS and
authenticated `pages.dev` previews are prohibited.

## Current preview rollout

The following rollout work has already been completed:

- the GitHub remotes were connected and the user pushed both repositories;
- migration `20261008120000_AddRefreshTokenFamilies` was applied and the API was restarted;
- CORS for `https://preview.billfolder.app` was validated;
- Cloudflare Worker `bill-folder-web-preview` is connected to `main` with automatic builds;
- `https://preview.billfolder.app` is active, with authentication and password recovery validated;
- deployment remains outside the implicit authorization of future changes.

The active Cloudflare Workers Builds configuration is:

- Project name: `bill-folder-web-preview`
- Production branch: `main`
- Build command: `npm run build:preview`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

The Workers Static Assets output directory is declared in `wrangler.jsonc`, not in the dashboard.
Node `24.15.0` or newer is required; Workers Builds detects the version from `package.json`.

Any new backend or web deployment, publication, production configuration change, SSH operation, or
production smoke still requires explicit authorization. The completed preview rollout does not make
deployment an implicit side effect of future code changes.
