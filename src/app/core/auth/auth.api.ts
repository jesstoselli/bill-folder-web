import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  ResetPasswordRequest,
  SignupRequest,
  WebAuthResponse,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(APP_ENVIRONMENT).apiBaseUrl.replace(/\/$/, '');
  private readonly authUrl = `${this.apiBaseUrl}/auth`;
  private readonly webAuthUrl = `${this.authUrl}/web`;

  login(request: LoginRequest): Observable<WebAuthResponse> {
    return this.http.post<WebAuthResponse>(`${this.webAuthUrl}/login`, request, {
      withCredentials: true,
    });
  }

  signup(request: SignupRequest): Observable<WebAuthResponse> {
    return this.http.post<WebAuthResponse>(`${this.webAuthUrl}/signup`, request, {
      withCredentials: true,
    });
  }

  refresh(): Observable<WebAuthResponse> {
    return this.http.post<WebAuthResponse>(`${this.webAuthUrl}/refresh`, null, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.webAuthUrl}/logout`, null, {
      withCredentials: true,
    });
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.authUrl}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.authUrl}/reset-password`, request);
  }
}
