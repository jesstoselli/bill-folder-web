import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiError } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  CardEntryDeleteScope,
  CardEntryRecurrenceResponse,
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CreateCardEntryRecurrenceRequest,
  CreateCardEntryRequest,
  CreditCardAccountResponse,
  PayCardStatementRequest,
  UpdateCardEntryRequest,
  UpdateCardSubscriptionAmountRequest,
} from './cards.models';

@Injectable({ providedIn: 'root' })
export class CardsApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;
  private readonly cardsUrl = apiUrl(this.baseUrl, 'credit-card-accounts');
  private readonly entriesUrl = apiUrl(this.baseUrl, 'card-entries');
  private readonly recurrencesUrl = apiUrl(this.baseUrl, 'card-entry-recurrences');
  private readonly statementsUrl = apiUrl(this.baseUrl, 'card-statements');

  listCards(): Observable<CreditCardAccountResponse[]> {
    return this.http.get<CreditCardAccountResponse[]>(`${this.cardsUrl}/`).pipe(this.mapErrors());
  }

  listEntries(cardId: string): Observable<CardEntryResponse[]> {
    const params = new HttpParams().set('cardId', cardId);
    return this.http
      .get<CardEntryResponse[]>(`${this.entriesUrl}/`, { params })
      .pipe(this.mapErrors());
  }

  createEntry(request: CreateCardEntryRequest): Observable<CardEntryResponse> {
    return this.write(
      this.http.post<CardEntryResponse>(`${this.entriesUrl}/`, request).pipe(this.mapErrors()),
    );
  }

  updateEntry(id: string, request: UpdateCardEntryRequest): Observable<CardEntryResponse> {
    return this.write(
      this.http
        .patch<CardEntryResponse>(`${this.entriesUrl}/${id}`, request)
        .pipe(this.mapErrors()),
    );
  }

  deleteEntry(id: string, scope: CardEntryDeleteScope): Observable<null> {
    const params = new HttpParams().set('scope', scope);
    return this.write(
      this.http.delete<null>(`${this.entriesUrl}/${id}`, { params }).pipe(this.mapErrors()),
    );
  }

  repriceSubscription(
    id: string,
    request: UpdateCardSubscriptionAmountRequest,
  ): Observable<CardEntryResponse> {
    return this.write(
      this.http
        .post<CardEntryResponse>(`${this.entriesUrl}/${id}/update-amount`, request)
        .pipe(this.mapErrors()),
    );
  }

  createRecurrence(
    request: CreateCardEntryRecurrenceRequest,
  ): Observable<CardEntryRecurrenceResponse> {
    return this.write(
      this.http
        .post<CardEntryRecurrenceResponse>(`${this.recurrencesUrl}/`, request)
        .pipe(this.mapErrors()),
    );
  }

  listStatements(cardId: string): Observable<CardStatementResponse[]> {
    const params = new HttpParams().set('cardId', cardId);
    return this.http
      .get<CardStatementResponse[]>(`${this.statementsUrl}/`, { params })
      .pipe(this.mapErrors());
  }

  getStatement(id: string): Observable<CardStatementDetailResponse> {
    return this.http
      .get<CardStatementDetailResponse>(`${this.statementsUrl}/${id}`)
      .pipe(this.mapErrors());
  }

  payStatement(id: string, request: PayCardStatementRequest): Observable<CardStatementResponse> {
    return this.write(
      this.http
        .post<CardStatementResponse>(`${this.statementsUrl}/${id}/pay`, request)
        .pipe(this.mapErrors()),
    );
  }

  private write<T>(operation: Observable<T>): Observable<T> {
    return notifyingWrite(this.changes, operation);
  }

  private mapErrors<T>(): (source: Observable<T>) => Observable<T> {
    return (source) =>
      source.pipe(catchError((error: unknown) => throwError(() => mapApiError(error))));
  }
}
