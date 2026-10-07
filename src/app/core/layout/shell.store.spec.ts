import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ShellStore } from './shell.store';

describe('ShellStore', () => {
  let layoutChanges: Subject<BreakpointState>;
  let observedQueries: readonly string[];
  let store: ShellStore;

  beforeEach(() => {
    layoutChanges = new Subject<BreakpointState>();
    observedQueries = [];

    TestBed.configureTestingModule({
      providers: [
        ShellStore,
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (queries: string | readonly string[]) => {
              observedQueries = typeof queries === 'string' ? [queries] : queries;
              return layoutChanges.asObservable();
            },
          },
        },
      ],
    });

    store = TestBed.inject(ShellStore);
  });

  it('observes the three layout ranges and maps them to shell modes', () => {
    expect(observedQueries).toEqual([
      '(min-width: 1200px)',
      '(min-width: 768px) and (max-width: 1199.98px)',
      '(max-width: 767.98px)',
    ]);

    layoutChanges.next({
      matches: true,
      breakpoints: {
        '(min-width: 1200px)': false,
        '(min-width: 768px) and (max-width: 1199.98px)': true,
        '(max-width: 767.98px)': false,
      },
    });

    expect(store.mode()).toBe('rail');
  });

  it('closes the drawer after navigation on narrow layout', () => {
    store.setMode('drawer');
    store.openDrawer();

    store.navigationCompleted();

    expect(store.drawerOpen()).toBe(false);
  });

  it('keeps the navigation surface closed outside drawer mode', () => {
    store.setMode('full');

    store.openDrawer();

    expect(store.drawerOpen()).toBe(false);
  });
});
