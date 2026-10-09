import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { mapApiErrors } from '../http/api-error';
import { apiUrl } from '../http/api-url';

export interface CategoryDto {
  readonly id: string;
  readonly key: string;
  readonly namePt: string;
  readonly isSystem: boolean;
  readonly displayOrder: number;
}

export interface CheckingAccountResponse {
  readonly id: string;
  readonly bankName: string;
  readonly branch: string | null;
  readonly accountNumber: string | null;
  readonly initialBalance: number;
  readonly isPrimary: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreditCardAccountResponse {
  readonly id: string;
  readonly name: string;
  readonly issuerBank: string | null;
  readonly brand: string | null;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavingsAccountResponse {
  readonly id: string;
  readonly checkingAccountId: string;
  readonly bankName: string;
  readonly branch: string;
  readonly accountNumber: string;
  readonly initialBalance: number;
  readonly currentBalance: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReferenceDataApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;

  categories(): Observable<CategoryDto[]> {
    return this.get<CategoryDto>('categories');
  }

  checkingAccounts(): Observable<CheckingAccountResponse[]> {
    return this.get<CheckingAccountResponse>('checking-accounts');
  }

  creditCardAccounts(): Observable<CreditCardAccountResponse[]> {
    return this.get<CreditCardAccountResponse>('credit-card-accounts');
  }

  savingsAccounts(): Observable<SavingsAccountResponse[]> {
    return this.get<SavingsAccountResponse>('savings-accounts');
  }

  private get<T>(path: string): Observable<T[]> {
    return this.http.get<T[]>(apiUrl(this.baseUrl, path)).pipe(mapApiErrors());
  }
}
