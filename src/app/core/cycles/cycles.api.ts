import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, Observable, of, throwError } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { mapApiError } from '../http/api-error';
import { apiUrl } from '../http/api-url';
import { CycleResponse } from './cycle.models';

@Injectable({ providedIn: 'root' })
export class CyclesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;

  list(): Observable<CycleResponse[]> {
    return this.http.get<CycleResponse[]>(apiUrl(this.baseUrl, 'cycles')).pipe(this.mapErrors());
  }

  current(): Observable<CycleResponse | null> {
    return this.http.get<CycleResponse>(apiUrl(this.baseUrl, 'cycles/current')).pipe(
      catchError((error: unknown) => {
        if (isNoCurrentCycle(error)) {
          return of(null);
        }
        return throwError(() => mapApiError(error));
      }),
    );
  }

  private mapErrors<T>(): (source: Observable<T>) => Observable<T> {
    return (source) =>
      source.pipe(catchError((error: unknown) => throwError(() => mapApiError(error))));
  }
}

function isNoCurrentCycle(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 404 &&
    typeof error.error === 'object' &&
    error.error !== null &&
    (error.error as Record<string, unknown>)['error'] === 'no_current_cycle'
  );
}
