import { Injectable, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  ReplaySubject,
  catchError,
  concatMap,
  defer,
  finalize,
  map,
  of,
  retry,
  shareReplay,
  take,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { AuthApi } from './auth.api';
import { AuthCoordinationService } from './auth-coordination.service';
import { AuthState, LoginRequest, SignupRequest, UserDto, WebAuthResponse } from './auth.models';
import { SessionEndRedirect } from './session-end-redirect';
import { isTransientFailure } from './auth-errors';

export interface RestoreRetryPolicy {
  readonly attempts: number;
  readonly delayMs: number;
}

/** How hard app start tries to restore a session while the API is unreachable. */
export const RESTORE_RETRY = new InjectionToken<RestoreRetryPolicy>('RESTORE_RETRY', {
  providedIn: 'root',
  factory: () => ({ attempts: 2, delayMs: 1500 }),
});

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly api = inject(AuthApi);
  private readonly coordination = inject(AuthCoordinationService);
  private readonly redirect = inject(SessionEndRedirect);
  private readonly restoreRetry = inject(RESTORE_RETRY);
  private readonly state = signal<AuthState>({ kind: 'restoring' });
  private refreshInFlight: Observable<void> | null = null;
  private logoutInFlight: Observable<void> | null = null;
  private logoutRequested = false;
  private sessionEpoch = 0;
  private cookieMutationTail: Observable<void> = of(void 0);

  readonly user: Signal<UserDto | null> = computed(() => {
    const state = this.state();
    return state.kind === 'authenticated' ? state.user : null;
  });
  readonly isAuthenticated: Signal<boolean> = computed(() => this.state().kind === 'authenticated');
  readonly accessToken: Signal<string | null> = computed(() => {
    const state = this.state();
    return state.kind === 'authenticated' ? state.accessToken : null;
  });

  isLogoutPending(): boolean {
    return this.logoutRequested;
  }

  constructor() {
    this.coordination.logoutEvents.pipe(takeUntilDestroyed()).subscribe(() => {
      const wasAuthenticated = this.isAuthenticated();
      this.clear();
      if (wasAuthenticated) {
        // Let this tab's in-flight cookie mutation settle first: unloading
        // mid-refresh would break the cross-tab ordering logout relies on.
        this.cookieMutationTail.pipe(take(1)).subscribe(() => this.redirect.toLogin());
      }
    });
  }

  restore(): Observable<void> {
    this.state.set({ kind: 'restoring' });
    // Opening the app during a deploy or on a flaky connection must not
    // throw a valid session away; only a rejected cookie ends it at once.
    return defer(() => this.refreshOnce()).pipe(
      retry({
        count: this.restoreRetry.attempts,
        delay: (error: unknown) =>
          isTransientFailure(error) ? timer(this.restoreRetry.delayMs) : throwError(() => error),
      }),
      catchError(() => {
        this.clear();
        return of(void 0);
      }),
    );
  }

  login(request: LoginRequest): Observable<void> {
    return this.authenticate(() => this.api.login(request));
  }

  signup(request: SignupRequest): Observable<void> {
    return this.authenticate(() => this.api.signup(request));
  }

  logout(): Observable<void> {
    if (this.logoutInFlight) {
      return this.logoutInFlight;
    }

    this.logoutRequested = true;
    this.clear();
    this.coordination.broadcastLogout();

    const queuedLogout = this.enqueueCookieMutation(() =>
      this.api.logout().pipe(
        catchError(() => of(void 0)),
        map(() => void 0),
      ),
    );
    const logout = queuedLogout.pipe(
      finalize(() => {
        if (this.logoutInFlight === logout) {
          this.logoutInFlight = null;
          this.logoutRequested = false;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
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

    const queuedRefresh = defer(() => {
      if (this.logoutRequested) {
        return throwError(() => new Error('Refresh blocked while logout is in progress.'));
      }

      const refreshEpoch = this.sessionEpoch;
      return this.enqueueCookieMutation(() =>
        this.api.refresh().pipe(
          tap((response) => {
            if (refreshEpoch === this.sessionEpoch) {
              this.accept(response);
            }
          }),
          map(() => void 0),
        ),
      );
    });
    const refresh = queuedRefresh.pipe(
      finalize(() => {
        if (this.refreshInFlight === refresh) {
          this.refreshInFlight = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
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

  private authenticate(operation: () => Observable<WebAuthResponse>): Observable<void> {
    return defer(() => {
      const authEpoch = this.sessionEpoch;
      const enqueueAuthentication = () =>
        this.enqueueCookieMutation(() =>
          operation().pipe(
            tap((response) => {
              if (authEpoch === this.sessionEpoch) {
                this.accept(response);
              }
            }),
            map(() => void 0),
          ),
        );
      const pendingLogout = this.logoutInFlight;
      return pendingLogout
        ? pendingLogout.pipe(concatMap(() => enqueueAuthentication()))
        : enqueueAuthentication();
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  private enqueueCookieMutation(operation: () => Observable<void>): Observable<void> {
    return defer(() => {
      const predecessor = this.cookieMutationTail;
      const release = new ReplaySubject<void>(1);
      let started = false;
      let released = false;

      const releaseSlot = () => {
        if (!released) {
          released = true;
          release.next();
          release.complete();
        }
      };

      this.cookieMutationTail = release.asObservable();

      return predecessor.pipe(
        take(1),
        concatMap(() => {
          started = true;
          return this.coordination.runExclusive(operation);
        }),
        finalize(() => {
          if (started) {
            releaseSlot();
            return;
          }

          predecessor.pipe(take(1)).subscribe({
            next: releaseSlot,
            error: releaseSlot,
          });
        }),
      );
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }
}
