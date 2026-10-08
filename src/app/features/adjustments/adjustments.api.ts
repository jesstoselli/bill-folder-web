import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiError } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  CreateCycleAdjustmentRequest,
  CycleAdjustmentResponse,
  UpdateCycleAdjustmentRequest,
} from './adjustments.models';

@Injectable({ providedIn: 'root' })
export class AdjustmentsApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly url = apiUrl(inject(APP_ENVIRONMENT).apiBaseUrl, 'cycle-adjustments');

  list(from: string, to: string): Observable<CycleAdjustmentResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<CycleAdjustmentResponse[]>(`${this.url}/`, { params })
      .pipe(this.mapErrors());
  }
  create(request: CreateCycleAdjustmentRequest): Observable<CycleAdjustmentResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<CycleAdjustmentResponse>(`${this.url}/`, request).pipe(this.mapErrors()),
    );
  }
  update(id: string, request: UpdateCycleAdjustmentRequest): Observable<CycleAdjustmentResponse> {
    return notifyingWrite(
      this.changes,
      this.http.patch<CycleAdjustmentResponse>(`${this.url}/${id}`, request).pipe(this.mapErrors()),
    );
  }
  delete(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.url}/${id}`).pipe(this.mapErrors()),
    );
  }
  private mapErrors<T>(): (source: Observable<T>) => Observable<T> {
    return (source) =>
      source.pipe(catchError((error: unknown) => throwError(() => mapApiError(error))));
  }
}
