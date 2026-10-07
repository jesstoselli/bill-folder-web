import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
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
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clear();
          return of(void 0);
        }
        return throwError(() => error);
      }),
    );
  }

  login(request: LoginRequest): Observable<void> {
    return this.api.login(request).pipe(
      tap((response) => this.accept(response)),
      map(() => void 0),
    );
  }

  signup(request: SignupRequest): Observable<void> {
    return this.api.signup(request).pipe(
      tap((response) => this.accept(response)),
      map(() => void 0),
    );
  }

  logout(): Observable<void> {
    return defer(() => {
      this.clear();
      return this.api.logout().pipe(catchError(() => of(void 0)));
    });
  }

  refreshOnce(): Observable<void> {
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
}
