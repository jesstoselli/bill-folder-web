import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { ApiError } from '../http/api-error';
import { CycleResponse } from './cycle.models';
import { CyclesApi } from './cycles.api';

const cycle: CycleResponse = {
  id: '0199-cycle',
  startDate: '2026-09-28',
  endDate: '2026-10-27',
  label: 'outubro/2026',
  isRecurrenceGenerated: false,
  isCurrent: true,
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
};

describe('CyclesApi', () => {
  let api: CyclesApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1/', production: false } },
      ],
    });
    api = TestBed.inject(CyclesApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the cycle list using the exact JSON contract', async () => {
    const result = firstValueFrom(api.list());
    const request = backend.expectOne('/v1/cycles');
    expect(request.request.method).toBe('GET');
    request.flush([cycle]);

    await expect(result).resolves.toEqual([cycle]);
  });

  it('maps the confirmed no_current_cycle 404 to an absent current cycle', async () => {
    const result = firstValueFrom(api.current());
    backend
      .expectOne('/v1/cycles/current')
      .flush(
        { error: 'no_current_cycle', message: 'Nenhum ciclo ativo cobre a data de hoje.' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(result).resolves.toBeNull();
  });

  it('maps other failures to the safe API error shape', async () => {
    const result = firstValueFrom(api.current());
    backend
      .expectOne('/v1/cycles/current')
      .flush(
        { error: 'not_found', message: 'Ciclo não encontrado.' },
        { status: 404, statusText: 'Not Found internals' },
      );

    await expect(result).rejects.toEqual({
      status: 404,
      code: 'not_found',
      message: 'Ciclo não encontrado.',
    } satisfies ApiError);
  });
});
