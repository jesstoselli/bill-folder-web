import { HttpErrorResponse } from '@angular/common/http';
import { mapApiError } from './api-error';

describe('mapApiError', () => {
  it('preserves useful backend status, code and message', () => {
    const mapped = mapApiError(
      new HttpErrorResponse({
        status: 409,
        statusText: 'Conflict internals',
        error: { error: 'duplicate_start_date', message: 'Já existe um ciclo nessa data.' },
      }),
    );

    expect(mapped).toEqual({
      status: 409,
      code: 'duplicate_start_date',
      message: 'Já existe um ciclo nessa data.',
    });
  });

  it('maps a network failure without leaking raw event internals', () => {
    const mapped = mapApiError(
      new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
        error: new ProgressEvent('secret-network-event'),
      }),
    );

    expect(mapped).toEqual({
      status: 0,
      code: 'network_error',
      message: 'Não foi possível conectar ao servidor.',
    });
    expect(JSON.stringify(mapped)).not.toContain('secret-network-event');
  });

  it('uses a safe fallback for malformed server errors', () => {
    expect(
      mapApiError(
        new HttpErrorResponse({
          status: 500,
          statusText: 'Database host and stack trace',
          error: { message: { internal: 'sensitive detail' } },
        }),
      ),
    ).toEqual({
      status: 500,
      code: 'http_500',
      message: 'Servidor indisponível. Tente novamente em instantes.',
    });
  });

  it('does not expose a textual message without the backend error code', () => {
    expect(
      mapApiError(
        new HttpErrorResponse({
          status: 500,
          statusText: 'Internal Server Error',
          error: { message: 'Connection string and database hostname' },
        }),
      ),
    ).toEqual({
      status: 500,
      code: 'http_500',
      message: 'Servidor indisponível. Tente novamente em instantes.',
    });
  });
});
