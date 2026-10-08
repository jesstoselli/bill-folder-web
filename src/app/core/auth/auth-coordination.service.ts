import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, Subject, defer, firstValueFrom, from } from 'rxjs';

export const AUTH_COOKIE_LOCK_NAME = 'billfolder-auth-cookie-mutation';
const AUTH_CHANNEL_NAME = 'billfolder-auth-session';
const AUTH_STORAGE_KEY = 'billfolder:auth-event';

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

interface BroadcastChannelLike {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
  close(): void;
}

interface BroadcastChannelConstructor {
  new (name: string): BroadcastChannelLike;
}

export interface AuthBrowser {
  readonly navigator: { readonly locks?: LockManagerLike };
  readonly BroadcastChannel?: BroadcastChannelConstructor;
  readonly localStorage: Pick<Storage, 'setItem' | 'removeItem'>;
  addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
}

export const AUTH_BROWSER = new InjectionToken<AuthBrowser | null>('AUTH_BROWSER', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).defaultView as unknown as AuthBrowser | null,
});

@Injectable({ providedIn: 'root' })
export class AuthCoordinationService {
  private readonly browser = inject(AUTH_BROWSER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logoutSubject = new Subject<void>();
  private readonly channel = this.createChannel();
  private readonly storageListener = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY || event.newValue === null) {
      return;
    }

    try {
      const message = JSON.parse(event.newValue) as { type?: unknown };
      if (message.type === 'logout') {
        this.logoutSubject.next();
      }
    } catch {
      // Ignore malformed events from unrelated/older clients.
    }
  };

  readonly logoutEvents = this.logoutSubject.asObservable();

  constructor() {
    if (!this.channel) {
      this.browser?.addEventListener('storage', this.storageListener);
    }
    this.destroyRef.onDestroy(() => {
      this.channel?.close();
      this.browser?.removeEventListener('storage', this.storageListener);
      this.logoutSubject.complete();
    });
  }

  runExclusive<T>(operation: () => Observable<T>): Observable<T> {
    const locks = this.browser?.navigator.locks;
    if (!locks) {
      return operation();
    }

    return defer(() =>
      from(locks.request(AUTH_COOKIE_LOCK_NAME, () => firstValueFrom(operation()))),
    );
  }

  broadcastLogout(): void {
    const message = { type: 'logout' as const };
    if (this.channel) {
      this.channel.postMessage(message);
      return;
    }

    if (!this.browser) {
      return;
    }

    const payload = JSON.stringify({ ...message, nonce: crypto.randomUUID() });
    this.browser.localStorage.setItem(AUTH_STORAGE_KEY, payload);
    this.browser.localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  private createChannel(): BroadcastChannelLike | null {
    const Channel = this.browser?.BroadcastChannel;
    if (!Channel) {
      return null;
    }

    const channel = new Channel(AUTH_CHANNEL_NAME);
    channel.onmessage = (event) => {
      const message = event.data as { type?: unknown } | null;
      if (message?.type === 'logout') {
        this.logoutSubject.next();
      }
    };
    return channel;
  }
}
