import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { apiUrl } from '../http/api-url';
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
  private readonly apiBaseUrl = inject(APP_ENVIRONMENT).apiBaseUrl;

  login(request: LoginRequest): Observable<WebAuthResponse> {
    return this.http.post<WebAuthResponse>(apiUrl(this.apiBaseUrl, 'auth/web/login'), request, {
      withCredentials: true,
    });
  }

  signup(request: SignupRequest): Observable<WebAuthResponse> {
    return this.http.post<WebAuthResponse>(apiUrl(this.apiBaseUrl, 'auth/web/signup'), request, {
      withCredentials: true,
    });
  }

  refresh(): Observable<WebAuthResponse> {
    return this.http.post<WebAuthResponse>(apiUrl(this.apiBaseUrl, 'auth/web/refresh'), null, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(apiUrl(this.apiBaseUrl, 'auth/web/logout'), null, {
      withCredentials: true,
    });
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(
      apiUrl(this.apiBaseUrl, 'auth/forgot-password'),
      request,
    );
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(apiUrl(this.apiBaseUrl, 'auth/reset-password'), request);
  }
}
