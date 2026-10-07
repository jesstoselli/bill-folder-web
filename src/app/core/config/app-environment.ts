import { InjectionToken } from '@angular/core';

export interface AppEnvironment {
  apiBaseUrl: string;
  production: boolean;
}

export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('APP_ENVIRONMENT');
