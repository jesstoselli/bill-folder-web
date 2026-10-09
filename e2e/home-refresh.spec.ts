import { expect, test } from './fixtures/api.fixture';

test('Home reflects a write without reloading the browser page', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/home');
  await expect(page.locator('.balance-hero__amount')).toContainText('R$ 1.500,00');
  const pageIdentity = await page.evaluate(() => {
    const global = globalThis as typeof globalThis & { __billFolderE2EPageIdentity?: string };
    global.__billFolderE2EPageIdentity = crypto.randomUUID();
    return global.__billFolderE2EPageIdentity;
  });

  await page.getByLabel('Despesas', { exact: true }).click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição').fill('Internet E2E');
  await page.getByLabel('Vencimento').fill('2026-10-22');
  await page.getByLabel('Valor esperado').fill('200');
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Casa' }).click();
  await page.getByRole('button', { name: 'Salvar despesa' }).click();
  await expect(page.locator('[data-expense-id="expense-created"]')).toContainText('Internet E2E');

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.locator('.balance-hero__amount')).toContainText('R$ 1.300,00');
  expect(
    await page.evaluate(
      () =>
        (globalThis as typeof globalThis & { __billFolderE2EPageIdentity?: string })
          .__billFolderE2EPageIdentity,
    ),
  ).toBe(pageIdentity);
  expect(api.events).toContain('home:refreshed-after-write');
  expect(
    api.reads.filter((read) => read.path === '/v1/home/' && read.query === 'cycleId=cycle-oct-2026')
      .length,
  ).toBeGreaterThanOrEqual(2);
});
