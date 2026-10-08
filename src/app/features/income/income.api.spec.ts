import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { IncomeApi } from './income.api';
import { IncomeEntryResponse } from './income.models';

const entry: IncomeEntryResponse = {
  id: 'income-1',
  sourceId: null,
  sourceOrigin: null,
  expectedAmount: 250,
  actualAmount: null,
  expectedDate: '2026-10-18',
  actualDate: null,
  status: 'expected',
  notes: 'Freela',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

describe('IncomeApi', () => {
  let api: IncomeApi;
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
    api = TestBed.inject(IncomeApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });

  afterEach(() => backend.verify());

  it('lists cycle income and active sources using the exact URLs', async () => {
    const list = firstValueFrom(api.list('2026-10-01', '2026-10-31'));
    const listRequest = backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31');
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush([entry]);
    await expect(list).resolves.toEqual([entry]);

    const sources = firstValueFrom(api.listSources());
    const sourceRequest = backend.expectOne('/v1/income-sources/?activeOnly=true');
    expect(sourceRequest.request.method).toBe('GET');
    sourceRequest.flush([]);
    await expect(sources).resolves.toEqual([]);
    expect(changes.version()).toBe(0);
  });

  it('sends null source exactly when creating an avulso entry', async () => {
    const request = {
      sourceId: null,
      expectedAmount: 250,
      expectedDate: '2026-10-18',
      notes: null,
    };
    const result = firstValueFrom(api.create(request));
    const post = backend.expectOne('/v1/income-entries/');

    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(request);
    post.flush(entry);

    await expect(result).resolves.toEqual(entry);
    expect(changes.version()).toBe(1);
  });

  it('confirms receipt with received status, actual amount and actual date', async () => {
    const confirmation = {
      status: 'received' as const,
      actualAmount: 248.75,
      actualDate: '2026-10-19',
    };
    const result = firstValueFrom(api.confirmReceived('income-1', confirmation));
    const patch = backend.expectOne('/v1/income-entries/income-1');

    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual(confirmation);
    patch.flush({ ...entry, ...confirmation });

    await expect(result).resolves.toMatchObject(confirmation);
    expect(changes.version()).toBe(1);
  });

  it('keeps the API error and does not notify after a failed confirmation', async () => {
    const result = firstValueFrom(
      api.confirmReceived('income-1', {
        status: 'received',
        actualAmount: 248.75,
        actualDate: '2026-10-19',
      }),
    );
    backend
      .expectOne('/v1/income-entries/income-1')
      .flush(
        { error: 'validation_error', message: 'Valor recebido inválido.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(result).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
      message: 'Valor recebido inválido.',
    });
    expect(changes.version()).toBe(0);
  });
});
