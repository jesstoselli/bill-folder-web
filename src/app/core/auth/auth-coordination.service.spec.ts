import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  AUTH_BROWSER,
  AUTH_COOKIE_LOCK_NAME,
  AuthBrowser,
  AuthCoordinationService,
} from './auth-coordination.service';

describe('AuthCoordinationService', () => {
  it('runs cookie mutations under the shared Web Lock', async () => {
    const requested: string[] = [];
    const browser = fakeBrowser({
      navigator: {
        locks: {
          request: async <T>(name: string, callback: () => Promise<T>) => {
            requested.push(name);
            return callback();
          },
        },
      },
    });
    TestBed.configureTestingModule({ providers: [{ provide: AUTH_BROWSER, useValue: browser }] });

    const result = await firstValueFrom(
      TestBed.inject(AuthCoordinationService).runExclusive(() => of('completed')),
    );

    expect(result).toBe('completed');
    expect(requested).toEqual([AUTH_COOKIE_LOCK_NAME]);
  });

  it('broadcasts logout, receives remote logout and closes the channel on cleanup', () => {
    const browser = fakeBrowser({ BroadcastChannel: FakeBroadcastChannel });
    TestBed.configureTestingModule({ providers: [{ provide: AUTH_BROWSER, useValue: browser }] });
    const service = TestBed.inject(AuthCoordinationService);
    const received = vi.fn();
    service.logoutEvents.subscribe(received);

    service.broadcastLogout();
    FakeBroadcastChannel.instance?.onmessage?.({ data: { type: 'logout' } } as MessageEvent);

    expect(FakeBroadcastChannel.instance?.posted).toEqual([{ type: 'logout' }]);
    expect(received).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    expect(FakeBroadcastChannel.instance?.closed).toBe(true);
  });

  it('falls back safely when Web Locks and BroadcastChannel are unavailable', async () => {
    const browser = fakeBrowser();
    TestBed.configureTestingModule({ providers: [{ provide: AUTH_BROWSER, useValue: browser }] });
    const service = TestBed.inject(AuthCoordinationService);
    const received = vi.fn();
    service.logoutEvents.subscribe(received);

    await expect(firstValueFrom(service.runExclusive(() => of('fallback')))).resolves.toBe(
      'fallback',
    );
    service.broadcastLogout();
    browser.dispatchStorage({ key: 'billfolder:auth-event', newValue: '{"type":"logout"}' });

    expect(browser.storageWrites).toBe(1);
    expect(received).toHaveBeenCalledTimes(1);
  });
});

class FakeBroadcastChannel {
  static instance: FakeBroadcastChannel | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly posted: unknown[] = [];
  closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instance = this;
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  close(): void {
    this.closed = true;
  }
}

function fakeBrowser(
  overrides: Partial<AuthBrowser> = {},
): AuthBrowser & { storageWrites: number; dispatchStorage(event: Partial<StorageEvent>): void } {
  let storageListener: ((event: StorageEvent) => void) | null = null;
  const browser = {
    navigator: {},
    storageWrites: 0,
    localStorage: {
      setItem: () => {
        browser.storageWrites += 1;
      },
      removeItem: () => undefined,
    },
    addEventListener: (_name: 'storage', listener: (event: StorageEvent) => void) => {
      storageListener = listener;
    },
    removeEventListener: () => {
      storageListener = null;
    },
    dispatchStorage: (event: Partial<StorageEvent>) => storageListener?.(event as StorageEvent),
    ...overrides,
  };
  return browser as AuthBrowser & {
    storageWrites: number;
    dispatchStorage(event: Partial<StorageEvent>): void;
  };
}
