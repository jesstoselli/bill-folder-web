import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataChangeService } from '../data-change/data-change.service';
import { ActiveRouteRefreshService } from '../refresh/active-route-refresh.service';
import { CycleListResource } from './cycle-list-resource';
import { CycleResponse } from './cycle.models';
import { CycleStore } from './cycle.store';

describe('CycleListResource reloads after writes', () => {
  let current: WritableSignal<CycleResponse | null>;
  let fetch: Mock<(cycle: CycleResponse) => Observable<{ id: string }[]>>;
  let owner: { refresh: () => Promise<void> };
  let changes: DataChangeService;
  let activeRoute: ActiveRouteRefreshService;

  beforeEach(() => {
    current = signal<CycleResponse | null>(october);
    TestBed.configureTestingModule({
      providers: [{ provide: CycleStore, useValue: { current: current.asReadonly() } }],
    });
    changes = TestBed.inject(DataChangeService);
    activeRoute = TestBed.inject(ActiveRouteRefreshService);
    fetch = vi.fn((_cycle: CycleResponse) => of([{ id: 'row' }]));
    owner = { refresh: () => Promise.resolve() };
    TestBed.runInInjectionContext(() => new CycleListResource({ owner, fetch }));
    TestBed.tick();
  });

  it('reloads at once while its page is on screen', () => {
    activeRoute.register(owner);
    changes.notify();
    TestBed.tick();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stays stale while another page is shown and catches up when its page returns', () => {
    const unregister = activeRoute.register({ refresh: () => undefined });
    changes.notify();
    changes.notify();
    TestBed.tick();
    expect(fetch).toHaveBeenCalledTimes(1);

    unregister();
    activeRoute.register(owner);
    TestBed.tick();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not reload when its page returns without any write in between', () => {
    const unregister = activeRoute.register({ refresh: () => undefined });
    TestBed.tick();
    unregister();
    activeRoute.register(owner);
    TestBed.tick();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('still follows a cycle change while hidden', () => {
    activeRoute.register({ refresh: () => undefined });
    current.set(november);
    TestBed.tick();

    expect(fetch).toHaveBeenLastCalledWith(november);
  });
});

const october = cycle('2026-10', '2026-10-01', '2026-10-31');
const november = cycle('2026-11', '2026-11-01', '2026-11-30');

function cycle(id: string, startDate: string, endDate: string): CycleResponse {
  return { id, startDate, endDate } as CycleResponse;
}
