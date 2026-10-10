import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, Observable, of, throwError } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { DataChangeService } from '../data-change/data-change.service';
import { notifyingWrite } from '../data-change/notifying-write';
import { mapApiError, mapApiErrors } from '../http/api-error';
import { apiUrl } from '../http/api-url';
import { CreateCycleRequest, CycleResponse, UpdateCycleRequest } from './cycle.models';

@Injectable({ providedIn: 'root' })
export class CyclesApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly url = apiUrl(inject(APP_ENVIRONMENT).apiBaseUrl, 'cycles');

  list(): Observable<CycleResponse[]> {
    return this.http.get<CycleResponse[]>(this.url).pipe(mapApiErrors());
  }

  current(): Observable<CycleResponse | null> {
    return this.http.get<CycleResponse>(`${this.url}/current`).pipe(
      catchError((error: unknown) => {
        if (isNoCurrentCycle(error)) {
          return of(null);
        }
        return throwError(() => mapApiError(error));
      }),
    );
  }

  create(request: CreateCycleRequest): Observable<CycleResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<CycleResponse>(`${this.url}/`, request).pipe(mapApiErrors()),
    );
  }

  update(id: string, request: UpdateCycleRequest): Observable<CycleResponse> {
    return notifyingWrite(
      this.changes,
      this.http.patch<CycleResponse>(`${this.url}/${id}`, request).pipe(mapApiErrors()),
    );
  }

  delete(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.url}/${id}`).pipe(mapApiErrors()),
    );
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
