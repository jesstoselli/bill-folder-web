import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell.component';

const placeholder = () =>
  import('./shared/components/feature-placeholder/feature-placeholder.component').then(
    ({ FeaturePlaceholderComponent }) => FeaturePlaceholderComponent,
  );

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
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
