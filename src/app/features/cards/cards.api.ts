import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiErrors } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  CardEntryDeleteScope,
  CardEntryRecurrenceResponse,
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CreateCardEntryRecurrenceRequest,
  CreateCardEntryRequest,
  CreateCreditCardAccountRequest,
  CreditCardAccountResponse,
  PayCardStatementRequest,
  UpdateCardEntryRequest,
  UpdateCardSubscriptionAmountRequest,
  UpdateCreditCardAccountRequest,
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
    return this.http.get<CreditCardAccountResponse[]>(`${this.cardsUrl}/`).pipe(mapApiErrors());
  }

  createCard(request: CreateCreditCardAccountRequest): Observable<CreditCardAccountResponse> {
    return this.write(
      this.http.post<CreditCardAccountResponse>(`${this.cardsUrl}/`, request).pipe(mapApiErrors()),
    );
  }

  updateCard(
    id: string,
    request: UpdateCreditCardAccountRequest,
  ): Observable<CreditCardAccountResponse> {
    return this.write(
      this.http
        .patch<CreditCardAccountResponse>(`${this.cardsUrl}/${id}`, request)
        .pipe(mapApiErrors()),
    );
  }

  deleteCard(id: string): Observable<null> {
    return this.write(this.http.delete<null>(`${this.cardsUrl}/${id}`).pipe(mapApiErrors()));
  }

  listEntries(cardId: string): Observable<CardEntryResponse[]> {
    const params = new HttpParams().set('cardId', cardId);
    return this.http
      .get<CardEntryResponse[]>(`${this.entriesUrl}/`, { params })
      .pipe(mapApiErrors());
  }

  createEntry(request: CreateCardEntryRequest): Observable<CardEntryResponse> {
    return this.write(
      this.http.post<CardEntryResponse>(`${this.entriesUrl}/`, request).pipe(mapApiErrors()),
    );
  }

  updateEntry(id: string, request: UpdateCardEntryRequest): Observable<CardEntryResponse> {
    return this.write(
      this.http.patch<CardEntryResponse>(`${this.entriesUrl}/${id}`, request).pipe(mapApiErrors()),
    );
  }

  deleteEntry(id: string, scope: CardEntryDeleteScope): Observable<null> {
    const params = new HttpParams().set('scope', scope);
    return this.write(
      this.http.delete<null>(`${this.entriesUrl}/${id}`, { params }).pipe(mapApiErrors()),
    );
  }

  repriceSubscription(
    id: string,
    request: UpdateCardSubscriptionAmountRequest,
  ): Observable<CardEntryResponse> {
    return this.write(
      this.http
        .post<CardEntryResponse>(`${this.entriesUrl}/${id}/update-amount`, request)
        .pipe(mapApiErrors()),
    );
  }

  createRecurrence(
    request: CreateCardEntryRecurrenceRequest,
  ): Observable<CardEntryRecurrenceResponse> {
    return this.write(
      this.http
        .post<CardEntryRecurrenceResponse>(`${this.recurrencesUrl}/`, request)
        .pipe(mapApiErrors()),
    );
  }

  listStatements(cardId: string): Observable<CardStatementResponse[]> {
    const params = new HttpParams().set('cardId', cardId);
    return this.http
      .get<CardStatementResponse[]>(`${this.statementsUrl}/`, { params })
      .pipe(mapApiErrors());
  }

  getStatement(id: string): Observable<CardStatementDetailResponse> {
    return this.http
      .get<CardStatementDetailResponse>(`${this.statementsUrl}/${id}`)
      .pipe(mapApiErrors());
  }

  payStatement(id: string, request: PayCardStatementRequest): Observable<CardStatementResponse> {
    return this.write(
      this.http
        .post<CardStatementResponse>(`${this.statementsUrl}/${id}/pay`, request)
        .pipe(mapApiErrors()),
    );
  }

  private write<T>(operation: Observable<T>): Observable<T> {
    return notifyingWrite(this.changes, operation);
  }
}
