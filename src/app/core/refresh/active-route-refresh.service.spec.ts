import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { CycleStore } from '../cycles/cycle.store';
import {
  ActiveRouteRefreshService,
  RESUME_FRESHNESS_MS,
  TabResumeRefreshService,
} from './active-route-refresh.service';

describe('tab resume refresh', () => {
  function setup() {
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget() as Document;
    let visibility: DocumentVisibilityState = 'visible';
    Object.defineProperties(documentTarget, {
      defaultView: { value: windowTarget },
      visibilityState: { get: () => visibility, configurable: true },
    });
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const cycles = { load: vi.fn(() => Promise.resolve()) };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: documentTarget },
        { provide: CycleStore, useValue: cycles },
      ],
    });
    const active = TestBed.inject(ActiveRouteRefreshService);
    TestBed.inject(TabResumeRefreshService);
    const refresh = vi.fn(() => Promise.resolve());
    active.register(refresh);

    const hide = () => {
      visibility = 'hidden';
      documentTarget.dispatchEvent(new Event('visibilitychange'));
    };
    const show = () => {
      visibility = 'visible';
      documentTarget.dispatchEvent(new Event('visibilitychange'));
    };
    const advance = (ms: number) => (now += ms);
    return { hide, show, advance, refresh, cycles, windowTarget };
  }

  afterEach(() => vi.restoreAllMocks());

  it('reloads cycles and the active route after five minutes in the background', async () => {
    const { hide, show, advance, refresh, cycles } = setup();

    hide();
    advance(RESUME_FRESHNESS_MS);
    show();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    expect(cycles.load).toHaveBeenCalledOnce();
  });

  it('does not refetch after a short trip to another tab', () => {
    const { hide, show, advance, refresh, cycles } = setup();

    hide();
    advance(RESUME_FRESHNESS_MS - 1);
    show();

    expect(cycles.load).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('measures time hidden, not time since the tab was last shown', () => {
    const { hide, show, advance, refresh } = setup();

    advance(RESUME_FRESHNESS_MS * 3);
    hide();
    advance(1_000);
    show();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('treats a back/forward cache restore after a long pagehide as a resume', async () => {
    const { advance, refresh, windowTarget } = setup();

    windowTarget.dispatchEvent(new Event('pagehide'));
    advance(RESUME_FRESHNESS_MS);
    windowTarget.dispatchEvent(new Event('pageshow'));

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('coalesces an in-flight active route refresh', async () => {
    const active = (() => {
      const { hide, show, advance } = setup();
      const service = TestBed.inject(ActiveRouteRefreshService);
      const slow = vi.fn(() => new Promise<void>(() => undefined));
      service.register(slow);
      return { hide, show, advance, slow, service };
    })();

    void active.service.refresh();
    void active.service.refresh();

    expect(active.slow).toHaveBeenCalledOnce();
  });

  it('removes listeners when its injector is destroyed', () => {
    const { hide, show, advance, refresh } = setup();

    hide();
    TestBed.resetTestingModule();
    advance(RESUME_FRESHNESS_MS);
    show();

    expect(refresh).not.toHaveBeenCalled();
  });
});
