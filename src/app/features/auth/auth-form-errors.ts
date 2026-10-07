import { HttpErrorResponse } from '@angular/common/http';

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  email_already_registered: 'Já existe uma conta com esse email.',
  invalid_credentials: 'Email ou senha incorretos.',
  invalid_reset_code: 'Código inválido ou expirado.',
  validation_error: 'Revise os campos destacados e tente novamente.',
};

export function authErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const code = isRecord(error.error) ? error.error['error'] : null;
  return typeof code === 'string' ? (ERROR_MESSAGES[code] ?? fallback) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
