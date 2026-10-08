import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, toArray } from 'rxjs';
import { DataChangeService } from './data-change.service';
import { notifyingWrite } from './notifying-write';

describe('data change invalidation', () => {
  let changes: DataChangeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    changes = TestBed.inject(DataChangeService);
  });

  it('bumps once after a successful HTTP write', async () => {
    const before = changes.version();

    await firstValueFrom(notifyingWrite(changes, of({ id: 'write-result' })));

    expect(changes.version()).toBe(before + 1);
  });

  it('does not bump after a failed write', async () => {
    const before = changes.version();

    await expect(
      firstValueFrom(
        notifyingWrite(
          changes,
          throwError(() => new Error('boom')),
        ),
      ),
    ).rejects.toThrow('boom');

    expect(changes.version()).toBe(before);
  });

  it('bumps no more than once per subscribed operation', async () => {
    const before = changes.version();

    expect(await firstValueFrom(notifyingWrite(changes, of(1, 2)).pipe(toArray()))).toEqual([1, 2]);

    expect(changes.version()).toBe(before + 1);
  });
});
