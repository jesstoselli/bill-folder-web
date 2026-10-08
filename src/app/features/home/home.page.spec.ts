import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { homeFixture } from './home.fixtures';
import { HomePage } from './home.page';
import { HomeStore } from './home.store';

const currentCycle: CycleResponse = {
  ...homeFixture.cycle,
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

describe('HomePage tabs', () => {
  beforeEach(async () => {
    const homeState = signal({
      kind: 'content' as const,
      data: homeFixture,
      refreshing: false,
    });
    const recent = signal([]);
    const cycleState = signal({
      kind: 'content' as const,
      data: [currentCycle],
      refreshing: false,
    });
    const current = signal<CycleResponse | null>(currentCycle);
    const previous = signal<string | null>(null);
    const next = signal<string | null>(null);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        {
          provide: HomeStore,
          useValue: {
            state: homeState.asReadonly(),
            recentDailyExpenses: recent.asReadonly(),
            load: vi.fn(() => Promise.resolve()),
            refresh: vi.fn(() => Promise.resolve()),
            selectCycle: vi.fn(() => true),
          },
        },
        {
          provide: CycleStore,
          useValue: {
            state: cycleState.asReadonly(),
            current: current.asReadonly(),
            previous: previous.asReadonly(),
            next: next.asReadonly(),
            load: vi.fn(() => Promise.resolve()),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('links every tab to the panel and labels the panel from the keyboard-selected tab', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const panel = root.querySelector<HTMLElement>('[role="tabpanel"]');
    const upcoming = root.querySelector<HTMLButtonElement>('[data-tab="upcoming"]');
    const recent = root.querySelector<HTMLButtonElement>('[data-tab="recent"]');
    const overdue = root.querySelector<HTMLButtonElement>('[data-tab="overdue"]');

    expect(panel?.id).toBe('home-obligations-panel');
    expect([upcoming?.id, recent?.id, overdue?.id]).toEqual([
      'home-tab-upcoming',
      'home-tab-recent',
      'home-tab-overdue',
    ]);
    for (const tab of [upcoming, recent, overdue]) {
      expect(tab?.getAttribute('aria-controls')).toBe(panel?.id);
    }
    expect(panel?.getAttribute('aria-labelledby')).toBe(upcoming?.id);

    upcoming?.focus();
    upcoming?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(recent?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(recent);
    expect(panel?.getAttribute('aria-labelledby')).toBe(recent?.id);
  });
});
