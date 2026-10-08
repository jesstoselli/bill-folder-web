import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
  ActiveRouteRefreshService,
  RESUME_FRESHNESS_MS,
  TabResumeRefreshService,
} from './active-route-refresh.service';

describe('tab resume refresh', () => {
  it('refreshes the active route only after five minutes and coalesces an in-flight refresh', async () => {
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget() as Document;
    Object.defineProperties(documentTarget, {
      defaultView: { value: windowTarget },
      visibilityState: { value: 'visible', configurable: true },
    });
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentTarget }],
    });
    const active = TestBed.inject(ActiveRouteRefreshService);
    TestBed.inject(TabResumeRefreshService);
    const refresh = vi.fn(() => new Promise<void>(() => undefined));
    active.register(refresh);

    now += RESUME_FRESHNESS_MS - 1;
    windowTarget.dispatchEvent(new Event('pageshow'));
    expect(refresh).not.toHaveBeenCalled();

    now += RESUME_FRESHNESS_MS;
    windowTarget.dispatchEvent(new Event('pageshow'));
    expect(refresh).toHaveBeenCalledTimes(1);

    now += RESUME_FRESHNESS_MS;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    windowTarget.dispatchEvent(new Event('pageshow'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('removes listeners when its injector is destroyed', () => {
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget() as Document;
    Object.defineProperties(documentTarget, {
      defaultView: { value: windowTarget },
      visibilityState: { value: 'visible' },
    });
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: documentTarget }],
    });
    const active = TestBed.inject(ActiveRouteRefreshService);
    TestBed.inject(TabResumeRefreshService);
    const refresh = vi.fn();
    active.register(refresh);

    TestBed.resetTestingModule();
    now += RESUME_FRESHNESS_MS;
    windowTarget.dispatchEvent(new Event('pageshow'));

    expect(refresh).not.toHaveBeenCalled();
  });
});
