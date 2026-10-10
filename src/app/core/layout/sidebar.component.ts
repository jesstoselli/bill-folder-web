import { Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import type { BillFolderIconName } from '../../shared/components/icon/icon.component';
import { ShellMode } from './shell.store';

interface NavigationDestination {
  readonly label: string;
  readonly path: string;
  readonly icon: BillFolderIconName;
}

interface NavigationSection {
  readonly label: string;
  readonly destinations: readonly NavigationDestination[];
}

const NAVIGATION_SECTIONS: readonly NavigationSection[] = [
  {
    label: 'Principal',
    destinations: [
      {
        label: 'Home',
        path: '/home',
        icon: 'home',
      },
      {
        label: 'Despesas',
        path: '/despesas',
        icon: 'receiptLong',
      },
      {
        label: 'Despesas avulsas',
        path: '/gastos-diarios',
        icon: 'shoppingBag',
      },
      {
        label: 'Recebimentos',
        path: '/receitas',
        icon: 'attachMoney',
      },
      {
        label: 'Despesas no cartão',
        path: '/cartoes',
        icon: 'creditCard',
      },
      {
        label: 'Poupança',
        path: '/poupanca',
        icon: 'savings',
      },
      {
        label: 'Ajustes',
        path: '/ajustes',
        icon: 'tune',
      },
    ],
  },
  {
    label: 'Gerenciar',
    destinations: [
      {
        label: 'Ciclos',
        path: '/gerenciar/ciclos',
        icon: 'calendarMonth',
      },
      {
        label: 'Contas-correntes',
        path: '/gerenciar/contas',
        icon: 'accountBalance',
      },
      {
        label: 'Cartões',
        path: '/gerenciar/cartoes',
        icon: 'creditCard',
      },
      {
        label: 'Poupanças',
        path: '/gerenciar/poupancas',
        icon: 'savings',
      },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, MatTooltipModule, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly activeRoute = input<string>('/home');
  readonly mode = input<ShellMode>('full');
  readonly navigationRequested = output<void>();
  readonly logoutRequested = output<void>();

  protected readonly sections = NAVIGATION_SECTIONS;

  protected isActive(path: string): boolean {
    const activeRoute = this.activeRoute().split(/[?#]/, 1)[0];
    return activeRoute === path || activeRoute.startsWith(`${path}/`);
  }
}
