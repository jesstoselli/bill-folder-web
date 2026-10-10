import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiErrors } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  CreateSavingsAccountRequest,
  CreateSavingsTransactionRequest,
  SavingsAccountResponse,
  SavingsTransactionResponse,
  UpdateSavingsAccountRequest,
  UpdateSavingsTransactionRequest,
} from './savings.models';

@Injectable({ providedIn: 'root' })
export class SavingsApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;
  private readonly accountsUrl = apiUrl(this.baseUrl, 'savings-accounts');
  private readonly transactionsUrl = apiUrl(this.baseUrl, 'savings-transactions');

  listAccounts(): Observable<SavingsAccountResponse[]> {
    return this.http.get<SavingsAccountResponse[]>(`${this.accountsUrl}/`).pipe(mapApiErrors());
  }

  createAccount(request: CreateSavingsAccountRequest): Observable<SavingsAccountResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<SavingsAccountResponse>(`${this.accountsUrl}/`, request).pipe(mapApiErrors()),
    );
  }

  updateAccount(
    id: string,
    request: UpdateSavingsAccountRequest,
  ): Observable<SavingsAccountResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .patch<SavingsAccountResponse>(`${this.accountsUrl}/${id}`, request)
        .pipe(mapApiErrors()),
    );
  }

  deleteAccount(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.accountsUrl}/${id}`).pipe(mapApiErrors()),
    );
  }

  listTransactions(
    savingsAccountId: string,
    from: string,
    to: string,
  ): Observable<SavingsTransactionResponse[]> {
    const params = new HttpParams()
      .set('savingsAccountId', savingsAccountId)
      .set('from', from)
      .set('to', to);
    return this.http
      .get<SavingsTransactionResponse[]>(`${this.transactionsUrl}/`, { params })
      .pipe(mapApiErrors());
  }

  createTransaction(
    request: CreateSavingsTransactionRequest,
  ): Observable<SavingsTransactionResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .post<SavingsTransactionResponse>(`${this.transactionsUrl}/`, request)
        .pipe(mapApiErrors()),
    );
  }

  updateTransaction(
    id: string,
    request: UpdateSavingsTransactionRequest,
  ): Observable<SavingsTransactionResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .patch<SavingsTransactionResponse>(`${this.transactionsUrl}/${id}`, request)
        .pipe(mapApiErrors()),
    );
  }

  deleteTransaction(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.transactionsUrl}/${id}`).pipe(mapApiErrors()),
    );
  }
}
