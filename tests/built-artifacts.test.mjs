import assert from 'node:assert/strict';
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

test('Cloudflare control files survive the production build unchanged', async () => {
  const [sourceHeaders, builtHeaders, sourceRedirects, builtRedirects] = await Promise.all([
    readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
    read('_headers'),
    readFile(new URL('../public/_redirects', import.meta.url), 'utf8'),
    read('_redirects'),
  ]);

  assert.equal(builtHeaders, sourceHeaders);
  assert.equal(builtRedirects, sourceRedirects);
});
