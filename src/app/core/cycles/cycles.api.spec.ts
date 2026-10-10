import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { DataChangeService } from '../data-change/data-change.service';
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
  let changes: DataChangeService;

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
    changes = TestBed.inject(DataChangeService);
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

  it('maps create, update and delete to the exact backend contract', async () => {
    const createBody = {
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      label: 'novembro/2026',
    } as const;
    const creation = firstValueFrom(api.create(createBody));
    const post = backend.expectOne('/v1/cycles/');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(createBody);
    post.flush(cycle);
    await expect(creation).resolves.toEqual(cycle);
    expect(changes.version()).toBe(1);

    const updateBody = { label: 'novo nome' } as const;
    const update = firstValueFrom(api.update('cycle-1', updateBody));
    const patch = backend.expectOne('/v1/cycles/cycle-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual(updateBody);
    patch.flush({ ...cycle, label: updateBody.label });
    await expect(update).resolves.toEqual({ ...cycle, label: updateBody.label });
    expect(changes.version()).toBe(2);

    const deletion = firstValueFrom(api.delete('cycle-1'));
    const remove = backend.expectOne('/v1/cycles/cycle-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await expect(deletion).resolves.toBeNull();
    expect(changes.version()).toBe(3);
  });

  it('does not notify shared data when a write fails', async () => {
    const deletion = firstValueFrom(api.delete('cycle-1'));
    backend
      .expectOne('/v1/cycles/cycle-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(deletion).rejects.toEqual({
      status: 409,
      code: 'conflict',
      message: 'Exclusão recusada.',
    } satisfies ApiError);
    expect(changes.version()).toBe(0);
  });
});
