import { expect, test } from './fixtures/api.fixture';

test('logs in, keeps the access token out of browser storage, and restores from the cookie', async ({
  api,
  context,
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('browser-user@example.test');
  await page.getByLabel('Senha').fill('local-only-password');
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url() === 'http://127.0.0.1:4301/v1/auth/web/login',
  );
  await page.getByRole('button', { name: 'Entrar' }).click();
  const loginResponse = await loginResponsePromise;

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();
  expect(await loginResponse.headerValue('access-control-allow-origin')).toBe(
    'http://127.0.0.1:4200',
  );
  expect(await loginResponse.headerValue('access-control-allow-credentials')).toBe('true');
  const cookieAfterLogin = (
    await context.cookies('http://127.0.0.1:4301/v1/auth/web/refresh')
  ).find((cookie) => cookie.name === 'bf_refresh');
  expect(cookieAfterLogin).toMatchObject({
    domain: '127.0.0.1',
    path: '/v1/auth/web',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  });
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);

  const refreshResponsePromise = page.waitForResponse(
    (response) => response.url() === 'http://127.0.0.1:4301/v1/auth/web/refresh',
  );
  await page.reload();
  const refreshResponse = await refreshResponsePromise;
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();
  expect(await refreshResponse.headerValue('access-control-allow-origin')).toBe(
    'http://127.0.0.1:4200',
  );
  expect(await refreshResponse.headerValue('access-control-allow-credentials')).toBe('true');
  expect(api.authRequests).toContainEqual({
    operation: 'login',
    originAccepted: true,
    bodyValidated: true,
    cookiePresent: false,
    cookieMatchedCurrent: false,
  });
  expect(api.authRequests).toContainEqual({
    operation: 'refresh',
    originAccepted: true,
    bodyValidated: true,
    cookiePresent: true,
    cookieMatchedCurrent: true,
  });
  expect(api.preflights).toContainEqual({
    path: '/v1/auth/web/login',
    requestedMethod: 'POST',
    requestedHeaders: ['content-type'],
  });
  expect(api.reads).toContainEqual({ path: '/v1/home/', query: 'cycleId=cycle-oct-2026' });
  expect(api.events.filter((event) => event === 'refresh:accepted').length).toBeGreaterThanOrEqual(
    1,
  );
});

test('a stale access token is rejected, refreshed, and retried with the rotated token', async ({
  api,
  context,
  page,
}) => {
  await api.startAuthenticated(context);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();

  api.failNextHomeRequestWith401();
  await page.getByRole('button', { name: 'Atualizar' }).click();

  await expect.poll(() => api.events).toContain('home:retry-used-current-token');
  expect(api.events).toContain('/v1/home/:stale-token-rejected');
  expect(
    api.authRequests.filter(
      (request) => request.operation === 'refresh' && request.cookieMatchedCurrent,
    ),
  ).toHaveLength(2);
  expect(
    api.reads.filter(
      (read) => read.path === '/v1/home/' && read.query === 'cycleId=cycle-oct-2026',
    ),
  ).toHaveLength(2);
});

test('a delayed refresh cannot restore the session after logout', async ({
  api,
  context,
  page,
}) => {
  await api.startAuthenticated(context);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();

  const initialCookie = (await context.cookies('http://127.0.0.1:4301/v1/auth/web/refresh')).find(
    (cookie) => cookie.name === 'bf_refresh',
  );
  expect(initialCookie).toBeDefined();

  const refresh = api.delayNextRefresh();
  const logout = api.delayNextLogout();
  api.failNextHomeRequestWith401();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await refresh.requested;

  const logoutResponsePromise = page.waitForResponse(
    (response) => response.url() === 'http://127.0.0.1:4301/v1/auth/web/logout',
  );
  await page.getByRole('button', { name: 'Sair' }).click();
  expect(api.events).not.toContain('logout:requested');

  refresh.release();
  await logout.requested;
  const lateCookie = (await context.cookies('http://127.0.0.1:4301/v1/auth/web/refresh')).find(
    (cookie) => cookie.name === 'bf_refresh',
  );
  expect(lateCookie).toBeDefined();
  expect(lateCookie?.value).not.toBe(initialCookie?.value);
  expect(lateCookie).toMatchObject({
    path: '/v1/auth/web',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  });
  expect(api.authRequests.at(-1)).toEqual({
    operation: 'logout',
    originAccepted: true,
    bodyValidated: true,
    cookiePresent: true,
    cookieMatchedCurrent: true,
  });

  logout.release();
  const logoutResponse = await logoutResponsePromise;
  expect(await logoutResponse.headerValue('access-control-allow-origin')).toBe(
    'http://127.0.0.1:4200',
  );
  expect(await logoutResponse.headerValue('access-control-allow-credentials')).toBe('true');
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies('http://127.0.0.1:4301/v1/auth/web/refresh')).some(
      (cookie) => cookie.name === 'bf_refresh',
    ),
  ).toBe(false);

  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(api.events).toEqual([
    'refresh:accepted',
    '/v1/home/:stale-token-rejected',
    'refresh:requested',
    'refresh:accepted',
    '/v1/home/:stale-token-rejected',
    'logout:requested',
    'logout:accepted',
    'refresh:rejected',
  ]);
});
