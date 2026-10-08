import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const output = new URL('../dist/bill-folder-web/browser/', import.meta.url);
const read = (path) => readFile(new URL(path, output), 'utf8');

test('production build contains an installable Angular PWA shell', async () => {
  await Promise.all([
    access(new URL('manifest.webmanifest', output)),
    access(new URL('ngsw-worker.js', output)),
    access(new URL('ngsw.json', output)),
  ]);

  const index = await read('index.html');
  assert.match(index, /rel="manifest" href="manifest\.webmanifest"/);

  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.name, 'BillFolder');
  assert.equal(manifest.short_name, 'BillFolder');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
});

test('built service worker has no API data cache', async () => {
  const config = JSON.parse(await read('ngsw.json'));
  const serialized = JSON.stringify(config).toLowerCase();

  assert.deepEqual(config.dataGroups ?? [], []);
  assert.equal(serialized.includes('/v1/'), false);
  assert.equal(serialized.includes('api.billfolder.app'), false);
});

test('Cloudflare security headers survive the build without a conflicting redirect file', async () => {
  const [sourceHeaders, builtHeaders] = await Promise.all([
    readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
    read('_headers'),
  ]);

  assert.equal(builtHeaders, sourceHeaders);
  await assert.rejects(access(new URL('_redirects', output)), { code: 'ENOENT' });
});

test('every built inline script is explicitly authorized by the deployed CSP', async () => {
  const [index, headers] = await Promise.all([read('index.html'), read('_headers')]);
  const csp = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1];
  assert.ok(csp, 'built _headers must contain a CSP');
  const scriptDirective = csp
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith('script-src '));
  assert.ok(scriptDirective, 'CSP must contain script-src');

  const inlineScripts = [...index.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes, body]) => !/\bsrc\s*=/.test(attributes) && body.trim())
    .map(([, , body]) => body);

  for (const script of inlineScripts) {
    const hash = createHash('sha256').update(script).digest('base64');
    assert.match(scriptDirective, new RegExp(`(?:^|\\s)'sha256-${escapeRegExp(hash)}'(?:\\s|$)`));
  }
});

test('the built screen stylesheet loads without executable inline promotion', async () => {
  const index = await read('index.html');
  const stylesheet = index.match(/<link\b[^>]*\brel="stylesheet"[^>]*>/i)?.[0];

  assert.ok(stylesheet, 'a production stylesheet link is required');
  assert.doesNotMatch(stylesheet, /\bmedia="print"/i);
  assert.doesNotMatch(stylesheet, /\bdata-beasties-media=/i);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
