import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { mapApiErrors } from '../../core/http/api-error';
import { apiUrl } from '../../core/http/api-url';
import { DailyExpenseResponse } from '../daily-expenses/daily-expenses.models';
import { HomeResponse } from './home.models';

@Injectable({ providedIn: 'root' })
export class HomeApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;

  get(cycleId?: string): Observable<HomeResponse> {
    const params = cycleId ? new HttpParams().set('cycleId', cycleId) : undefined;
    return this.http
      .get<HomeResponse>(`${apiUrl(this.baseUrl, 'home')}/`, { params })
      .pipe(mapApiErrors());
  }

  listDailyExpenses(from: string, to: string): Observable<DailyExpenseResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<DailyExpenseResponse[]>(apiUrl(this.baseUrl, 'daily-expenses'), { params })
      .pipe(mapApiErrors());
  }
}
