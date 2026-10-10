import { Subject, of, throwError } from 'rxjs';
import { ManagedListResource } from './managed-list-resource';

describe('ManagedListResource', () => {
  it('loads and sorts the list', async () => {
    const list = new ManagedListResource<number>({
      fetch: () => of([3, 1, 2]),
      compare: (left, right) => left - right,
    });

    await list.load();

    expect(list.items()).toEqual([1, 2, 3]);
  });

  it('keeps the previous rows when a reload fails', async () => {
    let fail = false;
    const list = new ManagedListResource<number>({
      fetch: () => (fail ? throwError(() => ({ status: 0 })) : of([1])),
    });
    await list.load();
    fail = true;

    await list.load();

    const state = list.state();
    expect(state.kind).toBe('content');
    expect(list.items()).toEqual([1]);
    expect(state.kind === 'content' && state.refreshError).toBeTruthy();
  });

  it('runs afterWrite and reloads after a successful write', async () => {
    const afterWrite = vi.fn();
    const fetch = vi.fn(() => of([1]));
    const list = new ManagedListResource<number>({ fetch, afterWrite });

    await expect(list.write(() => of('saved'))).resolves.toBe('saved');

    expect(afterWrite).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('neither runs afterWrite nor reloads when the write fails', async () => {
    const afterWrite = vi.fn();
    const fetch = vi.fn(() => of([1]));
    const list = new ManagedListResource<number>({ fetch, afterWrite });

    await expect(list.write(() => throwError(() => new Error('nope')))).rejects.toThrow('nope');

    expect(afterWrite).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores an older response that arrives after a newer one', async () => {
    const first = new Subject<number[]>();
    const responses = [first, of([2])];
    const list = new ManagedListResource<number>({ fetch: () => responses.shift()! });

    const older = list.load();
    await list.load();
    first.next([1]);
    first.complete();
    await older;

    expect(list.items()).toEqual([2]);
  });
});
