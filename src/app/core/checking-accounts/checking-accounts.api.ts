import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { DataChangeService } from '../data-change/data-change.service';
import { notifyingWrite } from '../data-change/notifying-write';
import { mapApiErrors } from '../http/api-error';
import { apiUrl } from '../http/api-url';
import {
  CheckingAccountResponse,
  CreateCheckingAccountRequest,
  UpdateCheckingAccountRequest,
} from './checking-account.models';

@Injectable({ providedIn: 'root' })
export class CheckingAccountsApi {
  private readonly http = inject(HttpClient);
  private readonly changes = inject(DataChangeService);
  private readonly url = apiUrl(inject(APP_ENVIRONMENT).apiBaseUrl, 'checking-accounts');

  list(): Observable<CheckingAccountResponse[]> {
    return this.http.get<CheckingAccountResponse[]>(`${this.url}/`).pipe(mapApiErrors());
  }

  get(id: string): Observable<CheckingAccountResponse> {
    return this.http.get<CheckingAccountResponse>(`${this.url}/${id}`).pipe(mapApiErrors());
  }

  create(request: CreateCheckingAccountRequest): Observable<CheckingAccountResponse> {
    return notifyingWrite(
      this.changes,
      this.http.post<CheckingAccountResponse>(`${this.url}/`, request).pipe(mapApiErrors()),
    );
  }

  update(id: string, request: UpdateCheckingAccountRequest): Observable<CheckingAccountResponse> {
    return notifyingWrite(
      this.changes,
      this.http.patch<CheckingAccountResponse>(`${this.url}/${id}`, request).pipe(mapApiErrors()),
    );
  }

  delete(id: string): Observable<null> {
    return notifyingWrite(
      this.changes,
      this.http.delete<null>(`${this.url}/${id}`).pipe(mapApiErrors()),
    );
  }
}
