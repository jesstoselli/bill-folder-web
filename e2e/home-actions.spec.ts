import { expect, test } from './fixtures/api.fixture';

test('opens the exact ordinary expense payment from Home', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/home');

  await page.getByRole('link', { name: 'Pagar Internet' }).click();

  await expect(page).toHaveURL(/\/despesas\?cycleId=cycle-oct-2026/);
  await expect(page.getByRole('heading', { name: 'Registrar pagamento' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Internet');
});

test('opens the exact provisioned occurrence payment from Home', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/home');

  await page.getByRole('link', { name: 'Pagar ocorrência de Terapia semanal' }).click();

  await expect(page).toHaveURL(/\/despesas\?cycleId=cycle-oct-2026/);
  await expect(page.getByRole('heading', { name: 'Registrar ocorrência' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Terapia semanal');
});

test('opens the exact closed statement payment from Home', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/home');

  await page.getByRole('link', { name: 'Pagar fatura Cartão E2E' }).click();

  await expect(page).toHaveURL(/\/cartoes\?cardId=card-e2e/);
  await expect(page.getByRole('heading', { name: 'Pagar fatura' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Cartão E2E');
});
