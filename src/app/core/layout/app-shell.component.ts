import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ShellStore } from './shell.store';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-shell',
  imports: [MatSidenavModule, RouterOutlet, SidebarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);

  readonly store = inject(ShellStore);
  readonly activeRoute = signal(this.router.url || '/home');
  readonly drawerMode = computed(() => this.store.mode() === 'drawer');
  readonly navigationOpen = computed(() => !this.drawerMode() || this.store.drawerOpen());

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.activeRoute.set(event.urlAfterRedirects);
        this.store.navigationCompleted();
      });
  }
}
