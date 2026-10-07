import { Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ShellMode } from './shell.store';

interface NavigationDestination {
  readonly label: string;
  readonly path: string;
  readonly iconPath: string;
}

const NAVIGATION_DESTINATIONS: readonly NavigationDestination[] = [
  {
    label: 'Home',
    path: '/home',
    iconPath: 'M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5z',
  },
  {
    label: 'Despesas',
    path: '/despesas',
    iconPath:
      'M5 3h14a1 1 0 0 1 1 1v16l-3-1.8-2.5 1.8-2.5-1.8L9.5 20 7 18.2 4 20V4a1 1 0 0 1 1-1zm3 5h8M8 12h8',
  },
  {
    label: 'Gastos diários',
    path: '/gastos-diarios',
    iconPath: 'M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm3-4v4m10-4v4M4 10h16m-8 3v4m-2-2h4',
  },
  {
    label: 'Receitas',
    path: '/receitas',
    iconPath: 'M12 21V5m-5 5 5-5 5 5M5 15v4h14v-4',
  },
  {
    label: 'Cartões',
    path: '/cartoes',
    iconPath: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 3h18M7 15h4',
  },
  {
    label: 'Poupança',
    path: '/poupanca',
    iconPath: 'M5 10h14v10H5zm2 0V7.5L12 4l5 3.5V10m-7 4h4m-2-2v4',
  },
  {
    label: 'Ajustes',
    path: '/ajustes',
    iconPath:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4',
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, MatTooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly activeRoute = input<string>('/home');
  readonly mode = input<ShellMode>('full');
  readonly navigationRequested = output<void>();

  protected readonly destinations = NAVIGATION_DESTINATIONS;

  protected isActive(path: string): boolean {
    const activeRoute = this.activeRoute().split(/[?#]/, 1)[0];
    return activeRoute === path || activeRoute.startsWith(`${path}/`);
  }
}
