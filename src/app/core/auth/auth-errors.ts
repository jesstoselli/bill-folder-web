import { HttpErrorResponse } from '@angular/common/http';

/** The API rejected the refresh cookie: the session is really over. */
export function isSessionRejection(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 400 || error.status === 401 || error.status === 403)
  );
}

/** Offline, or the API is restarting: worth trying again before giving up. */
export function isTransientFailure(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}
