import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('service worker caches only the application shell and local assets', async () => {
  const config = JSON.parse(await read('ngsw-config.json'));
  const serialized = JSON.stringify(config).toLowerCase();

  assert.ok(Array.isArray(config.assetGroups));
  assert.ok(config.assetGroups.length > 0);
  assert.equal('dataGroups' in config, false);
  assert.equal(serialized.includes('/v1'), false);
  assert.equal(serialized.includes('api.billfolder.app'), false);
});

test('production enables Angular service worker while E2E uses only its isolated API origin', async () => {
  const angular = JSON.parse(await read('angular.json'));
  const build = angular.projects.BillFolderWeb.architect.build;
  const production = build.configurations.production;
  const e2e = build.configurations.e2e;

  assert.equal(production.serviceWorker, 'ngsw-config.json');
  assert.equal(production.optimization?.styles?.inlineCritical, false);
  assert.deepEqual(e2e.fileReplacements, [
    {
      replace: 'src/environments/environment.ts',
      with: 'src/environments/environment.e2e.ts',
    },
  ]);

  const e2eEnvironment = await read('src/environments/environment.e2e.ts');
  assert.match(e2eEnvironment, /apiBaseUrl:\s*'http:\/\/127\.0\.0\.1:4301\/v1'/);
  assert.doesNotMatch(e2eEnvironment, /api\.billfolder\.app/);
});

test('authenticated preview uses the exact preview origin and production API contract', async () => {
  const [angular, packageJson, previewEnvironment, headers] = await Promise.all([
    read('angular.json').then(JSON.parse),
    read('package.json').then(JSON.parse),
    read('src/environments/environment.preview.ts'),
    read('public/_headers'),
  ]);
  const preview = angular.projects.BillFolderWeb.architect.build.configurations.preview;

  assert.equal(packageJson.scripts['build:preview'], 'ng build --configuration preview');
  assert.deepEqual(preview.fileReplacements, [
    {
      replace: 'src/environments/environment.ts',
      with: 'src/environments/environment.preview.ts',
    },
  ]);
  assert.equal(preview.serviceWorker, 'ngsw-config.json');
  assert.match(previewEnvironment, /apiBaseUrl:\s*'https:\/\/api\.billfolder\.app\/v1'/);
  assert.match(headers, /connect-src 'self' https:\/\/api\.billfolder\.app/);
  assert.doesNotMatch(
    `${JSON.stringify(preview)}${previewEnvironment}${headers}`,
    /pages\.dev|https?:\/\/\*/i,
  );
});

test('Cloudflare SPA fallback and security policy are explicit and restrictive', async () => {
  const redirects = await read('public/_redirects');
  assert.equal(redirects.trim(), '/* /index.html 200');

  const headers = await read('public/_headers');
  assert.match(headers, /^\/\*$/m);
  assert.match(headers, /^\s+X-Content-Type-Options: nosniff$/m);
  assert.match(headers, /^\s+Referrer-Policy: same-origin$/m);
  assert.match(headers, /^\s+X-Frame-Options: DENY$/m);
  assert.match(headers, /^\s+Permissions-Policy: /m);

  const csp = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1];
  assert.ok(csp, 'Content-Security-Policy header is required');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /font-src 'self'/);
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.billfolder\.app/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /https:\/\/(?!api\.billfolder\.app)/);
});

test('auth transport uses distinct origins and requires Secure refresh cookies in production', async () => {
  const [e2eEnvironment, productionEnvironment, cookieContract] = await Promise.all([
    read('src/environments/environment.e2e.ts'),
    read('src/environments/environment.ts'),
    read('config/web-auth-cookie-contract.json').then(JSON.parse),
  ]);

  assert.match(e2eEnvironment, /apiBaseUrl:\s*'http:\/\/127\.0\.0\.1:4301\/v1'/);
  assert.match(productionEnvironment, /apiBaseUrl:\s*'https:\/\/api\.billfolder\.app\/v1'/);
  assert.deepEqual(cookieContract.production, {
    path: '/v1/auth/web',
    httpOnly: true,
    sameSite: 'Strict',
    secure: true,
  });
  assert.deepEqual(cookieContract.preview, cookieContract.production);
  assert.deepEqual(cookieContract.localE2eHttp, {
    path: '/v1/auth/web',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
  });
});

test('CI enforces high-severity dependency audit with an explicit exception policy', async () => {
  const [workflow, packageJson, exceptions] = await Promise.all([
    read('.github/workflows/ci.yml'),
    read('package.json').then(JSON.parse),
    read('docs/security/npm-audit-exceptions.md'),
  ]);

  assert.equal(packageJson.scripts['audit:ci'], 'npm audit --audit-level=high');
  assert.match(workflow, /run: npm run audit:ci/);
  assert.match(exceptions, /No active exceptions/i);
  assert.match(exceptions, /expiry/i);
});
