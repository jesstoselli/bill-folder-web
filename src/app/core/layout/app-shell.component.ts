import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';
import { SessionEndRedirect } from '../auth/session-end-redirect';
import { ShellStore } from './shell.store';
import { SidebarComponent } from './sidebar.component';
import { TabResumeRefreshService } from '../refresh/active-route-refresh.service';

@Component({
  selector: 'app-shell',
  imports: [MatSidenavModule, RouterOutlet, SidebarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);
  private readonly sessionEndRedirect = inject(SessionEndRedirect);
  private readonly tabResumeRefresh = inject(TabResumeRefreshService);

  readonly store = inject(ShellStore);
  readonly activeRoute = signal(this.router.url || '/home');
  readonly drawerMode = computed(() => this.store.mode() === 'drawer');
  readonly navigationOpen = computed(() => !this.drawerMode() || this.store.drawerOpen());

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

  protected logout(): void {
    this.store.closeDrawer();
    // Reload only after the logout request settles so the cookie revocation
    // is not aborted by the page unload.
    this.session.logout().subscribe(() => this.sessionEndRedirect.toLogin());
  }
}
