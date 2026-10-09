import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiErrors } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  CreateExpenseRecurrenceRequest,
  CreateExpenseRequest,
  ExpenseDeleteScope,
  ExpenseRecurrenceResponse,
  ExpenseResponse,
  PayExpenseRequest,
  PayOccurrenceRequest,
  RepriceProvisionedExpenseRequest,
  UpdateExpenseRequest,
} from './expenses.models';

@Injectable({ providedIn: 'root' })
export class ExpensesApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;
  private readonly expensesUrl = apiUrl(this.baseUrl, 'expenses');
  private readonly recurrencesUrl = apiUrl(this.baseUrl, 'expense-recurrences');

  list(from: string, to: string): Observable<ExpenseResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ExpenseResponse[]>(`${this.expensesUrl}/`, { params })
      .pipe(mapApiErrors());
  }

  create(request: CreateExpenseRequest): Observable<ExpenseResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<ExpenseResponse>(`${this.expensesUrl}/`, request).pipe(mapApiErrors()),
    );
  }

  update(id: string, request: UpdateExpenseRequest): Observable<ExpenseResponse> {
    return notifyingWrite(
      this.changes,
      this.http.patch<ExpenseResponse>(`${this.expensesUrl}/${id}`, request).pipe(mapApiErrors()),
    );
  }

  pay(id: string, request: PayExpenseRequest): Observable<ExpenseResponse> {
    return this.update(id, { ...request, status: 'paid' });
  }

  payOccurrence(id: string, request: PayOccurrenceRequest): Observable<ExpenseResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .post<ExpenseResponse>(`${this.expensesUrl}/${id}/pay-occurrence`, request)
        .pipe(mapApiErrors()),
    );
  }

  repriceProvisioned(
    id: string,
    request: RepriceProvisionedExpenseRequest,
  ): Observable<ExpenseResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .post<ExpenseResponse>(`${this.expensesUrl}/${id}/update-amount`, request)
        .pipe(mapApiErrors()),
    );
  }

  createRecurrence(request: CreateExpenseRecurrenceRequest): Observable<ExpenseRecurrenceResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .post<ExpenseRecurrenceResponse>(`${this.recurrencesUrl}/`, request)
        .pipe(mapApiErrors()),
    );
  }

  deleteOne(id: string, scope: ExpenseDeleteScope): Observable<null> {
    const params = new HttpParams().set('scope', scope);
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.expensesUrl}/${id}`, { params }).pipe(mapApiErrors()),
    );
  }
}
