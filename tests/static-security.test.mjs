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

test('production enables Angular service worker while E2E keeps API traffic same-origin', async () => {
  const angular = JSON.parse(await read('angular.json'));
  const build = angular.projects.BillFolderWeb.architect.build;
  const production = build.configurations.production;
  const e2e = build.configurations.e2e;

  assert.equal(production.serviceWorker, 'ngsw-config.json');
  assert.deepEqual(e2e.fileReplacements, [
    {
      replace: 'src/environments/environment.ts',
      with: 'src/environments/environment.e2e.ts',
    },
  ]);

  const e2eEnvironment = await read('src/environments/environment.e2e.ts');
  assert.match(e2eEnvironment, /apiBaseUrl:\s*'\/v1'/);
  assert.doesNotMatch(e2eEnvironment, /api\.billfolder\.app/);
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
