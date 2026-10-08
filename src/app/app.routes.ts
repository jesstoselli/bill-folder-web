import { Routes } from '@angular/router';
import { anonymousGuard, authGuard } from './core/auth/auth.guard';
import { AppShellComponent } from './core/layout/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/login/login.page').then(({ LoginPage }) => LoginPage),
  },
  {
    path: 'cadastro',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/signup/signup.page').then(({ SignupPage }) => SignupPage),
  },
  {
    path: 'esqueci-senha',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.page').then(
        ({ ForgotPasswordPage }) => ForgotPasswordPage,
      ),
  },
  {
    path: 'redefinir-senha',
    canActivate: [anonymousGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.page').then(
        ({ ResetPasswordPage }) => ResetPasswordPage,
      ),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.page').then(({ HomePage }) => HomePage),
        data: { title: 'Home' },
      },
      {
        path: 'despesas',
        loadComponent: () =>
          import('./features/expenses/expenses.page').then(({ ExpensesPage }) => ExpensesPage),
        data: { title: 'Despesas' },
      },
      {
        path: 'gastos-diarios',
        loadComponent: () =>
          import('./features/daily-expenses/daily-expenses.page').then(
            ({ DailyExpensesPage }) => DailyExpensesPage,
          ),
        data: { title: 'Gastos diários' },
      },
      {
        path: 'receitas',
        loadComponent: () =>
          import('./features/income/income.page').then(({ IncomePage }) => IncomePage),
        data: { title: 'Receitas' },
      },
      {
        path: 'cartoes',
        loadComponent: () =>
          import('./features/cards/cards.page').then(({ CardsPage }) => CardsPage),
        data: { title: 'Cartões' },
      },
      {
        path: 'poupanca',
        loadComponent: () =>
          import('./features/savings/savings.page').then(({ SavingsPage }) => SavingsPage),
        data: { title: 'Poupança' },
      },
      {
        path: 'ajustes',
        loadComponent: () =>
          import('./features/adjustments/adjustments.page').then(
            ({ AdjustmentsPage }) => AdjustmentsPage,
          ),
        data: { title: 'Ajustes' },
      },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
