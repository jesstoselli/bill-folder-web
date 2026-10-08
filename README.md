# BillFolder Web

Angular 22 web client for the BillFolder MVP. The production build is an installable PWA: the
application shell and local assets are available offline, while every `/v1` API request remains
online-only. Access tokens stay in application memory and refresh authentication uses an HTTP-only
cookie managed by the API.

## Requirements

- Node.js **24.15.0** (the exact supported version is recorded in `.nvmrc`)
- npm **11.12.1**

```bash
nvm install
nvm use
npm ci
```

## Local development

The development client expects the BillFolder API at `http://localhost:5077/v1`.

```bash
npm start
```

Open `http://localhost:4200`. Local development does not enable the production service worker.

## Verification

```bash
npm run test:ci
npm run build:prod
npm run e2e
```

- `test:ci` runs the Angular unit suite and source-level PWA/security configuration tests.
- `build:prod` builds the application and then verifies the manifest, generated Angular service
  worker, absence of API data caching, and copied Cloudflare control files.
- `e2e` requires Node 24.15.0, starts the Angular E2E configuration on
  `http://127.0.0.1:4200`, and runs Chromium against a deterministic same-origin network fixture.
  It never calls the local or production API and uses no real credentials or secrets.

Use `npm run e2e:ui` for Playwright UI mode after starting from Node 24.15.0.

## Production build

```bash
npm run build:prod
```

The deployable static output is:

```text
dist/bill-folder-web/browser
```

`public/_redirects` supplies the SPA fallback. `public/_headers` supplies the static security
headers and a CSP that permits scripts and fonts only from the application origin, permits the
inline component styles required by the Angular runtime, and restricts network connections to the
application origin plus `https://api.billfolder.app`.

## Cloudflare Pages settings

When deployment is explicitly authorized, configure Cloudflare Pages with:

- Production branch: `main`
- Build command: `npm run build:prod`
- Build output directory: `dist/bill-folder-web/browser`
- Node version: `24.15.0`

Production setup is an authorization boundary. Do **not** create or connect a GitHub remote,
Cloudflare project or domain, configure the backend origin/CORS, deploy, publish, push, or run
production smoke tests without the user's explicit approval. Backend deployment and
`WebAuth:AllowedOrigins` changes are separate operations and are not part of local preview
readiness.
