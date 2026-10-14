import { expect, test } from './fixtures/api.fixture';

test('pays one occurrence of a weekly expense', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/despesas');

  const row = page.locator('[data-expense-id="expense-weekly"]');
  await expect(row).toContainText('Terapia semanal');
  await expect(row).toContainText('1 de 4 ocorrências pagas');
  await row.getByRole('button', { name: 'Ações para Terapia semanal' }).click();
  await page.getByRole('menuitem', { name: 'Pagar ocorrência' }).click();

  await expect(page.getByRole('heading', { name: 'Registrar ocorrência' })).toBeVisible();
  await page.getByLabel('Valor pago').fill('150');
  await page.getByLabel('Data do pagamento').fill('2026-10-08');
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();

  await expect(row).toContainText('2 de 4 ocorrências pagas');
  expect(api.writes).toContainEqual({
    method: 'POST',
    path: '/v1/expenses/expense-weekly/pay-occurrence',
    body: { amount: 150, paidDate: '2026-10-08', paidFromAccountId: null },
  });
  expect(api.reads).toContainEqual({
    path: '/v1/expenses/',
    query: 'from=2026-10-01&to=2026-10-31',
  });
});

test('cancelling the recurrence scope does not open the reprice dialog', async ({
  api,
  context,
  page,
}) => {
  await api.startAuthenticated(context);
  await page.goto('/despesas');

  const row = page.locator('[data-expense-id="expense-weekly"]');
  await row.getByRole('button', { name: 'Ações para Terapia semanal' }).click();
  await page.getByRole('menuitem', { name: 'Reajustar valor por sessão' }).click();

  const scope = page.getByRole('dialog', { name: 'Onde aplicar o novo valor?' });
  await expect(scope).toBeVisible();
  await scope.getByRole('button', { name: 'Cancelar' }).click();

  await expect(scope).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Reajustar valor por sessão' })).toHaveCount(0);
});
