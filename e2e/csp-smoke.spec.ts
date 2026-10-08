import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const buildRoot = resolve('dist/bill-folder-web/browser');

test('the production shell renders with its deployed CSP and noncritical stylesheet', async ({
  page,
}) => {
  const headers = parseCloudflareHeaders(await readFile(resolve(buildRoot, '_headers'), 'utf8'));
  const server = createServer(async (request, response) => {
    const requestPath = decodeURIComponent(
      new URL(request.url ?? '/', 'http://local.test').pathname,
    );
    const candidate = resolve(buildRoot, `.${requestPath}`);
    const filePath =
      candidate.startsWith(`${buildRoot}/`) && (await isFile(candidate))
        ? candidate
        : resolve(buildRoot, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      ...headers,
      'Content-Type': contentType(filePath),
    });
    response.end(body);
  });
  await listen(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static server did not bind TCP.');

  try {
    const violations: string[] = [];
    await page.addInitScript(() => {
      const target = globalThis as typeof globalThis & { __cspViolations?: string[] };
      target.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        target.__cspViolations?.push(`${event.violatedDirective}:${event.blockedURI}`);
      });
    });
    await page.route('https://api.billfolder.app/**', (route) => route.abort('blockedbyclient'));
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
        violations.push(message.text());
      }
    });

    const response = await page.goto(`http://127.0.0.1:${address.port}/login`);
    expect(response?.headers()['content-security-policy']).toBe(headers['Content-Security-Policy']);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    const stylesheet = page.locator('link[rel="stylesheet"]');
    await expect(stylesheet).toHaveCount(1);
    await expect(stylesheet).not.toHaveAttribute('media', 'print');
    await expect(stylesheet).not.toHaveAttribute('data-beasties-media', /.+/);
    expect(
      await page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        fontFamily: getComputedStyle(document.body).fontFamily,
      })),
    ).toEqual({
      background: 'rgb(10, 13, 10)',
      fontFamily: '"Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif',
    });
    expect(
      await page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __cspViolations?: string[];
            }
          ).__cspViolations,
      ),
    ).toEqual([]);
    expect(violations).toEqual([]);
  } finally {
    await close(server);
  }
});

function parseCloudflareHeaders(source: string): Record<string, string> {
  return Object.fromEntries(
    source
      .split('\n')
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => {
        const separator = line.indexOf(':');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function contentType(path: string): string {
  return (
    {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.ico': 'image/x-icon',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.woff2': 'font/woff2',
    }[extname(path)] ?? 'application/octet-stream'
  );
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolvePromise();
    });
  });
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
}
