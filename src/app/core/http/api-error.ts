import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, catchError, throwError } from 'rxjs';

export interface ApiError {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

export function mapApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body = asRecord(error.error);
    const code = stringValue(body?.['error']);
    const message = stringValue(body?.['message']);

    return {
      status: error.status,
      code: code ?? defaultCode(error.status),
      message: code && message ? message : defaultMessage(error.status),
    };
  }

  const candidate = asRecord(error);
  const status = numberValue(candidate?.['status']);
  const code = stringValue(candidate?.['code']);
  const message = stringValue(candidate?.['message']);
  if (status !== null && code && message) {
    return { status, code, message };
  }

  return {
    status: 0,
    code: 'unknown_error',
    message: 'Não foi possível concluir a operação.',
  };
}

function defaultCode(status: number): string {
  return status === 0 ? 'network_error' : `http_${status}`;
}

function defaultMessage(status: number): string {
  if (status === 0) {
    return 'Não foi possível conectar ao servidor.';
  }
  if (status >= 500) {
    return 'Servidor indisponível. Tente novamente em instantes.';
  }
  return 'Não foi possível concluir a operação.';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** RxJS operator: errors leave the API layer already mapped to ApiError. */
export function mapApiErrors<T>(): MonoTypeOperatorFunction<T> {
  return (source) =>
    source.pipe(catchError((error: unknown) => throwError(() => mapApiError(error))));
}
