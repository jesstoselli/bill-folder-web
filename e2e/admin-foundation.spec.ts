import { expect, test } from './fixtures/api.fixture';

test('admin foundation manages cycles with the expected HTTP contract', async ({
  api,
  context,
  page,
}) => {
  await api.startAuthenticated(context);
  await page.goto('/gerenciar/ciclos');
  await expect(page.getByRole('heading', { name: 'Ciclos' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo ciclo' }).click();
  await page.getByLabel('Nome do ciclo').fill('novembro/2026');
  await page.getByLabel('Data inicial').fill('2026-11-01');
  await page.getByLabel('Data final').fill('2026-11-30');
  await page.getByRole('button', { name: 'Salvar ciclo' }).click();

  const created = page.locator('[data-cycle-id="cycle-created"]');
  await expect(created).toContainText('novembro/2026');
  await created.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome do ciclo').fill('ciclo de novembro');
  await page.getByRole('button', { name: 'Salvar ciclo' }).click();
  await expect(created).toContainText('ciclo de novembro');

  await created.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Excluir ciclo' }).click();
  await expect(created).toHaveCount(0);

  expect(api.writes).toEqual(
    expect.arrayContaining([
      {
        method: 'POST',
        path: '/v1/cycles/',
        body: { label: 'novembro/2026', startDate: '2026-11-01', endDate: '2026-11-30' },
      },
      {
        method: 'PATCH',
        path: '/v1/cycles/cycle-created',
        body: { label: 'ciclo de novembro', startDate: '2026-11-01', endDate: '2026-11-30' },
      },
      { method: 'DELETE', path: '/v1/cycles/cycle-created', body: null },
    ]),
  );
});

test('admin foundation refreshes account consumers and preserves an account blocked by the API', async ({
  api,
  context,
  page,
}) => {
  await api.startAuthenticated(context);
  await page.goto('/gerenciar/contas');
  await expect(page.getByRole('heading', { name: 'Contas-correntes' })).toBeVisible();

  await page.getByRole('button', { name: 'Nova conta' }).click();
  await page.getByLabel('Banco').fill('Banco Novo');
  await page.getByLabel('Agência').fill('1234');
  await page.getByLabel('Número da conta').fill('987-0');
  await page.getByLabel('Saldo inicial').fill('900.00');
  await page.getByRole('switch', { name: 'Conta principal' }).click();
  await expect(page.getByRole('switch', { name: 'Conta principal' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.locator('[data-checking-account-id="checking-created"]')).toContainText(
    'Principal',
  );

  await page.getByRole('link', { name: 'Despesas', exact: true }).click();
  const expense = page.locator('[data-expense-id="expense-internet"]');
  await expense.getByRole('button', { name: 'Ações para Internet' }).click();
  await page.getByRole('menuitem', { name: 'Pagar despesa' }).click();
  await page.getByRole('combobox', { name: 'Conta usada (opcional)' }).press('Space');
  await expect(page.getByRole('option', { name: 'Banco Novo — principal' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fechar pagamento' }).click();

  await page.getByRole('link', { name: 'Contas-correntes' }).click();
  const inUse = page.locator('[data-checking-account-id="checking-primary"]');
  await inUse.getByRole('button', { name: 'Excluir conta Conta E2E' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir conta' }).click();
  await expect(inUse).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'Esta conta ainda está vinculada a uma poupança ou despesa avulsa.',
  );

  expect(api.writes).toContainEqual({
    method: 'POST',
    path: '/v1/checking-accounts/',
    body: {
      bankName: 'Banco Novo',
      branch: '1234',
      accountNumber: '987-0',
      initialBalance: 900,
      isPrimary: true,
    },
  });
});

for (const width of [320, 768, 1200]) {
  test(`admin foundation stays within the viewport at ${width}px`, async ({
    api,
    context,
    page,
  }) => {
    await api.startAuthenticated(context);
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/gerenciar/ciclos', '/gerenciar/contas']) {
      await page.goto(path);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
  });
}
