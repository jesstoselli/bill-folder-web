import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { AdjustmentsApi } from './adjustments.api';
import { CycleAdjustmentResponse } from './adjustments.models';

describe('AdjustmentsApi', () => {
  let api: AdjustmentsApi;
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
    api = TestBed.inject(AdjustmentsApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });
  afterEach(() => backend.verify());

  it('lists the exact selected interval from cycle-adjustments', async () => {
    const result = firstValueFrom(api.list('2026-10-01', '2026-10-31'));
    const request = backend.expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31');
    expect(request.request.method).toBe('GET');
    request.flush([adjustment]);
    await expect(result).resolves.toEqual([adjustment]);
    expect(changes.version()).toBe(0);
  });

  it('maps create, update and delete to the exact backend contract', async () => {
    const createBody = {
      type: 'outflow',
      label: 'Acerto',
      amount: 40,
      date: '2026-10-12',
      sourceSavingsTransactionId: null,
    } as const;
    const create = firstValueFrom(api.create(createBody));
    const post = backend.expectOne('/v1/cycle-adjustments/');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(createBody);
    post.flush(adjustment);
    await create;
    expect(changes.version()).toBe(1);

    const updateBody = {
      type: 'inflow',
      label: 'Acerto revisto',
      amount: 42,
      date: '2026-10-13',
      sourceSavingsTransactionId: null,
    } as const;
    const update = firstValueFrom(api.update('adjustment-1', updateBody));
    const patch = backend.expectOne('/v1/cycle-adjustments/adjustment-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual(updateBody);
    patch.flush({ ...adjustment, ...updateBody });
    await update;
    expect(changes.version()).toBe(2);

    const deletion = firstValueFrom(api.delete('adjustment-1'));
    const remove = backend.expectOne('/v1/cycle-adjustments/adjustment-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await deletion;
    expect(changes.version()).toBe(3);
  });

  it('does not notify shared data after a failed delete', async () => {
    const deletion = firstValueFrom(api.delete('adjustment-1'));
    backend
      .expectOne('/v1/cycle-adjustments/adjustment-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409, message: 'Exclusão recusada.' });
    expect(changes.version()).toBe(0);
  });
});

const adjustment: CycleAdjustmentResponse = {
  id: 'adjustment-1',
  type: 'outflow',
  label: 'Acerto',
  amount: 40,
  date: '2026-10-12',
  sourceSavingsTransactionId: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
};
