import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiErrors } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  CreateDailyExpenseRequest,
  DailyExpenseResponse,
  UpdateDailyExpenseRequest,
} from './daily-expenses.models';

@Injectable({ providedIn: 'root' })
export class DailyExpensesApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly url = apiUrl(inject(APP_ENVIRONMENT).apiBaseUrl, 'daily-expenses');

  list(from: string, to: string): Observable<DailyExpenseResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<DailyExpenseResponse[]>(`${this.url}/`, { params }).pipe(mapApiErrors());
  }

  create(request: CreateDailyExpenseRequest): Observable<DailyExpenseResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<DailyExpenseResponse>(`${this.url}/`, request).pipe(mapApiErrors()),
    );
  }

  update(id: string, request: UpdateDailyExpenseRequest): Observable<DailyExpenseResponse> {
    return notifyingWrite(
      this.changes,
      this.http.patch<DailyExpenseResponse>(`${this.url}/${id}`, request).pipe(mapApiErrors()),
    );
  }

  delete(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.url}/${id}`).pipe(mapApiErrors()),
    );
  }
}
