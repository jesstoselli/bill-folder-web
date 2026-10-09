import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { notifyingWrite } from '../../core/data-change/notifying-write';
import { mapApiErrors } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import {
  ConfirmIncomeReceivedRequest,
  CreateIncomeEntryRequest,
  IncomeEntryResponse,
  IncomeSourceResponse,
  UpdateIncomeEntryRequest,
} from './income.models';

@Injectable({ providedIn: 'root' })
export class IncomeApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;
  private readonly entriesUrl = apiUrl(this.baseUrl, 'income-entries');
  private readonly sourcesUrl = apiUrl(this.baseUrl, 'income-sources');

  list(from: string, to: string): Observable<IncomeEntryResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<IncomeEntryResponse[]>(`${this.entriesUrl}/`, { params })
      .pipe(mapApiErrors());
  }

  listSources(): Observable<IncomeSourceResponse[]> {
    const params = new HttpParams().set('activeOnly', true);
    return this.http
      .get<IncomeSourceResponse[]>(`${this.sourcesUrl}/`, { params })
      .pipe(mapApiErrors());
  }

  create(request: CreateIncomeEntryRequest): Observable<IncomeEntryResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<IncomeEntryResponse>(`${this.entriesUrl}/`, request).pipe(mapApiErrors()),
    );
  }

  update(id: string, request: UpdateIncomeEntryRequest): Observable<IncomeEntryResponse> {
    return notifyingWrite(
      this.changes,
      this.http
        .patch<IncomeEntryResponse>(`${this.entriesUrl}/${id}`, request)
        .pipe(mapApiErrors()),
    );
  }

  confirmReceived(
    id: string,
    request: ConfirmIncomeReceivedRequest,
  ): Observable<IncomeEntryResponse> {
    return this.update(id, request);
  }

  delete(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.entriesUrl}/${id}`).pipe(mapApiErrors()),
    );
  }
}
