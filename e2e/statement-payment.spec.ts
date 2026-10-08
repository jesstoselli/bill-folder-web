import { expect, test } from './fixtures/api.fixture';

test('pays a closed card statement and reloads its paid state', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/cartoes');

  await expect(page.getByRole('heading', { name: 'Cartões e faturas' })).toBeVisible();
  await expect(page.locator('.statement-summary')).toHaveAttribute('data-status', 'closed');
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  await page.getByLabel('Valor pago').fill('420.50');
  await page.getByLabel('Data do pagamento').fill('2026-10-08');
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click();

  await page.getByRole('button', { name: 'Atualizar' }).click();
  await expect(page.locator('.statement-summary')).toHaveAttribute('data-status', 'paid');
  await expect(page.getByText('Paga em 08/10/2026')).toBeVisible();
  expect(api.writes).toContainEqual({
    method: 'POST',
    path: '/v1/card-statements/statement-closed/pay',
    body: { actualAmount: 420.5, paidDate: '2026-10-08', paidFromAccountId: null },
  });
  expect(api.reads).toContainEqual({
    path: '/v1/card-statements/',
    query: 'cardId=card-e2e',
  });
  expect(api.reads).toContainEqual({
    path: '/v1/card-statements/statement-closed',
    query: '',
  });
});
