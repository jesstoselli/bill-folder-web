import { expect, test } from './fixtures/api.fixture';

test('logs in, keeps the access token out of browser storage, and restores from the cookie', async ({
  api,
  context,
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('browser-user@example.test');
  await page.getByLabel('Senha').fill('local-only-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();
  const cookiesAfterLogin = await context.cookies();
  expect(cookiesAfterLogin.some((cookie) => cookie.name === 'bf_refresh')).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);

  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();
  expect(api.events.filter((event) => event === 'refresh:accepted').length).toBeGreaterThanOrEqual(
    1,
  );
});

test('a delayed refresh cannot restore the session after logout', async ({
  api,
  context,
  page,
}) => {
  await api.startAuthenticated(context);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Resumo do ciclo' })).toBeVisible();

  const initialCookie = (await context.cookies()).find((cookie) => cookie.name === 'bf_refresh');
  expect(initialCookie).toBeDefined();

  const refresh = api.delayNextRefresh();
  const logout = api.delayNextLogout();
  api.failNextHomeRequestWith401();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await refresh.requested;

  await page.getByRole('button', { name: 'Sair' }).click();
  expect(api.events).not.toContain('logout:requested');

  refresh.release();
  await logout.requested;
  const lateCookie = (await context.cookies()).find((cookie) => cookie.name === 'bf_refresh');
  expect(lateCookie).toBeDefined();
  expect(lateCookie?.value).not.toBe(initialCookie?.value);

  logout.release();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).some((cookie) => cookie.name === 'bf_refresh')).toBe(false);

  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(api.events).toEqual([
    'refresh:accepted',
    'home:unauthorized',
    'refresh:requested',
    'refresh:accepted',
    'logout:requested',
    'logout:accepted',
    'refresh:rejected',
  ]);
});
