import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { AuthApi } from './auth.api';
import { AuthState, LoginRequest, SignupRequest, UserDto, WebAuthResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly api = inject(AuthApi);
  private readonly state = signal<AuthState>({ kind: 'restoring' });
  private refreshInFlight: Observable<void> | null = null;
  private logoutInFlight: Observable<void> | null = null;
  private logoutRequested = false;
  private sessionEpoch = 0;

  readonly user: Signal<UserDto | null> = computed(() => {
    const state = this.state();
    return state.kind === 'authenticated' ? state.user : null;
  });
  readonly isAuthenticated: Signal<boolean> = computed(() => this.state().kind === 'authenticated');
  readonly accessToken: Signal<string | null> = computed(() => {
    const state = this.state();
    return state.kind === 'authenticated' ? state.accessToken : null;
  });

  restore(): Observable<void> {
    this.state.set({ kind: 'restoring' });
    return this.refreshOnce().pipe(
      catchError(() => {
        this.clear();
        return of(void 0);
      }),
    );
  }

  login(request: LoginRequest): Observable<void> {
    return this.afterPendingLogout(() =>
      this.api.login(request).pipe(
        tap((response) => this.accept(response)),
        map(() => void 0),
      ),
    );
  }

  signup(request: SignupRequest): Observable<void> {
    return this.afterPendingLogout(() =>
      this.api.signup(request).pipe(
        tap((response) => this.accept(response)),
        map(() => void 0),
      ),
    );
  }

  logout(): Observable<void> {
    if (this.logoutInFlight) {
      return this.logoutInFlight;
    }

    this.logoutRequested = true;
    this.clear();

    const pendingRefresh = this.refreshInFlight?.pipe(catchError(() => of(void 0))) ?? of(void 0);
    const logout = pendingRefresh.pipe(
      concatMap(() => this.api.logout().pipe(catchError(() => of(void 0)))),
      map(() => void 0),
      finalize(() => {
        this.logoutInFlight = null;
        this.logoutRequested = false;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.logoutInFlight = logout;
    return logout;
  }

  refreshOnce(): Observable<void> {
    if (this.logoutRequested) {
      return throwError(() => new Error('Refresh blocked while logout is in progress.'));
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshEpoch = this.sessionEpoch;
    const refresh = this.api.refresh().pipe(
      tap((response) => {
        if (refreshEpoch === this.sessionEpoch) {
          this.accept(response);
        }
      }),
      map(() => void 0),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.refreshInFlight = refresh;
    return refresh;
  }

  clear(): void {
    this.sessionEpoch += 1;
    this.state.set({ kind: 'anonymous' });
  }

  private accept(response: WebAuthResponse): void {
    this.state.set({
      kind: 'authenticated',
      user: response.user,
      accessToken: response.accessToken,
      expiresAt: response.accessTokenExpiresAt,
    });
  }

  private afterPendingLogout(operation: () => Observable<void>): Observable<void> {
    return defer(() => {
      const pendingLogout = this.logoutInFlight;
      return pendingLogout ? pendingLogout.pipe(concatMap(() => operation())) : operation();
    });
  }
}
