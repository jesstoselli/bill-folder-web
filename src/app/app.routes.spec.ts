import { routes } from './app.routes';
import { anonymousGuard, authGuard } from './core/auth/auth.guard';
import { HomePage } from './features/home/home.page';
import { ExpensesPage } from './features/expenses/expenses.page';
import { DailyExpensesPage } from './features/daily-expenses/daily-expenses.page';
import { CardsPage } from './features/cards/cards.page';
import { SavingsPage } from './features/savings/savings.page';

describe('application routes', () => {
  it('keeps every MVP destination available behind the application shell', () => {
    const shellRoute = routes.find((route) => route.path === '');
    const destinations = shellRoute?.children
      ?.filter((route) => route.path && route.path !== '**')
      .map((route) => [route.path, route.data?.['title']]);

    expect(destinations).toEqual([
      ['home', 'Home'],
      ['despesas', 'Despesas'],
      ['gastos-diarios', 'Gastos diários'],
      ['receitas', 'Receitas'],
      ['cartoes', 'Cartões'],
      ['poupanca', 'Poupança'],
      ['ajustes', 'Ajustes'],
    ]);
    expect(shellRoute?.children?.find((route) => route.path === '')?.redirectTo).toBe('home');
    expect(shellRoute?.canActivate).toEqual([authGuard]);
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('home');
  });

  it('keeps public auth routes outside the application shell', () => {
    const publicRoutes = routes.filter((route) =>
      ['login', 'cadastro', 'esqueci-senha', 'redefinir-senha'].includes(route.path ?? ''),
    );

    expect(publicRoutes.map((route) => route.path)).toEqual([
      'login',
      'cadastro',
      'esqueci-senha',
      'redefinir-senha',
    ]);
    expect(publicRoutes.every((route) => route.canActivate?.includes(anonymousGuard))).toBe(true);
  });

  it('keeps the Home feature lazy-loaded', async () => {
    const homeRoute = routes
      .find((route) => route.path === '')
      ?.children?.find((route) => route.path === 'home');

    expect(homeRoute?.component).toBeUndefined();
    expect(homeRoute?.loadComponent).toBeTypeOf('function');
    await expect(homeRoute?.loadComponent?.()).resolves.toBe(HomePage);
  });

  it('lazy-loads the expenses ledger behind the application shell', async () => {
    const expensesRoute = routes
      .find((route) => route.path === '')
      ?.children?.find((route) => route.path === 'despesas');

    expect(expensesRoute?.component).toBeUndefined();
    expect(expensesRoute?.loadComponent).toBeTypeOf('function');
    await expect(expensesRoute?.loadComponent?.()).resolves.toBe(ExpensesPage);
  });

  it('lazy-loads the daily expenses ledger behind the application shell', async () => {
    const dailyExpensesRoute = routes
      .find((route) => route.path === '')
      ?.children?.find((route) => route.path === 'gastos-diarios');

    expect(dailyExpensesRoute?.component).toBeUndefined();
    expect(dailyExpensesRoute?.loadComponent).toBeTypeOf('function');
    await expect(dailyExpensesRoute?.loadComponent?.()).resolves.toBe(DailyExpensesPage);
  });

  it('lazy-loads cards and statements behind the application shell', async () => {
    const cardsRoute = routes
      .find((route) => route.path === '')
      ?.children?.find((route) => route.path === 'cartoes');

    expect(cardsRoute?.component).toBeUndefined();
    expect(cardsRoute?.loadComponent).toBeTypeOf('function');
    await expect(cardsRoute?.loadComponent?.()).resolves.toBe(CardsPage);
  });

  it('lazy-loads savings behind the application shell', async () => {
    const savingsRoute = routes
      .find((route) => route.path === '')
      ?.children?.find((route) => route.path === 'poupanca');

    expect(savingsRoute?.component).toBeUndefined();
    expect(savingsRoute?.loadComponent).toBeTypeOf('function');
    await expect(savingsRoute?.loadComponent?.()).resolves.toBe(SavingsPage);
  });
});
