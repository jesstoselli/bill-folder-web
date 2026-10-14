import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { userInitial } from '../../shared/formatters/user-initial';
import { ShellStore } from './shell.store';
import { SidebarComponent } from './sidebar.component';
import { TabResumeRefreshService } from '../refresh/active-route-refresh.service';

@Component({
  selector: 'app-shell',
  imports: [MatSidenavModule, RouterLink, RouterOutlet, SidebarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  protected readonly session = inject(AuthSessionService);
  private readonly tabResumeRefresh = inject(TabResumeRefreshService);

  readonly store = inject(ShellStore);
  readonly activeRoute = signal(this.router.url || '/home');
  readonly drawerMode = computed(() => this.store.mode() === 'drawer');
  readonly navigationOpen = computed(() => !this.drawerMode() || this.store.drawerOpen());
  protected readonly initial = computed(() => {
    const user = this.session.user();
    return user ? userInitial(user) : '';
  });

  constructor() {
    effect(() => {
      if (!this.session.isAuthenticated()) {
        void this.router.navigate(['/login']);
      }
    });

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
