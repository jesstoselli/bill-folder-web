import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';

export const RESUME_FRESHNESS_MS = 5 * 60 * 1_000;

@Injectable({ providedIn: 'root' })
export class ActiveRouteRefreshService {
  private callback: (() => void | Promise<void>) | null = null;
  private inFlight: Promise<void> | null = null;

  register(callback: () => void | Promise<void>): () => void {
    this.callback = callback;
    return () => {
      if (this.callback === callback) this.callback = null;
    };
  }

  refresh(): Promise<void> {
    if (!this.callback) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = Promise.resolve(this.callback())
      .catch(() => undefined)
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }
}

@Injectable({ providedIn: 'root' })
export class TabResumeRefreshService {
  private readonly document = inject(DOCUMENT);
  private readonly activeRoute = inject(ActiveRouteRefreshService);
  private readonly destroyRef = inject(DestroyRef);
  private lastVisibleAt = Date.now();

  constructor() {
    const onResume = () => this.handleResume();
    this.document.addEventListener('visibilitychange', onResume);
    this.document.defaultView?.addEventListener('pageshow', onResume);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onResume);
      this.document.defaultView?.removeEventListener('pageshow', onResume);
    });
  }

  private handleResume(): void {
    if (this.document.visibilityState !== 'visible') return;
    const now = Date.now();
    const stale = now - this.lastVisibleAt >= RESUME_FRESHNESS_MS;
    this.lastVisibleAt = now;
    if (stale) void this.activeRoute.refresh();
  }
}

export function registerActiveRouteRefresh(callback: () => void | Promise<void>): void {
  const activeRoute = inject(ActiveRouteRefreshService);
  const destroyRef = inject(DestroyRef);
  const unregister = activeRoute.register(callback);
  destroyRef.onDestroy(unregister);
}
