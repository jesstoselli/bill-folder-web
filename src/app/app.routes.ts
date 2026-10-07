import { Routes } from '@angular/router';
import { anonymousGuard, authGuard } from './core/auth/auth.guard';
import { AppShellComponent } from './core/layout/app-shell.component';

const placeholder = () =>
  import('./shared/components/feature-placeholder/feature-placeholder.component').then(
    ({ FeaturePlaceholderComponent }) => FeaturePlaceholderComponent,
  );

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
      { path: 'home', loadComponent: placeholder, data: { title: 'Home' } },
      { path: 'despesas', loadComponent: placeholder, data: { title: 'Despesas' } },
      {
        path: 'gastos-diarios',
        loadComponent: placeholder,
        data: { title: 'Gastos diários' },
      },
      { path: 'receitas', loadComponent: placeholder, data: { title: 'Receitas' } },
      { path: 'cartoes', loadComponent: placeholder, data: { title: 'Cartões' } },
      { path: 'poupanca', loadComponent: placeholder, data: { title: 'Poupança' } },
      { path: 'ajustes', loadComponent: placeholder, data: { title: 'Ajustes' } },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
