import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { CycleStore } from '../cycles/cycle.store';

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
  private readonly cycles = inject(CycleStore);
  /** When the tab went to the background; null while it is in use. */
  private hiddenAt: number | null = null;

  constructor() {
    const onVisibility = () => this.handleVisibility();
    const onHide = () => this.markHidden();
    this.document.addEventListener('visibilitychange', onVisibility);
    this.document.defaultView?.addEventListener('pageshow', onVisibility);
    this.document.defaultView?.addEventListener('pagehide', onHide);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.document.defaultView?.removeEventListener('pageshow', onVisibility);
      this.document.defaultView?.removeEventListener('pagehide', onHide);
    });
  }

  private markHidden(): void {
    this.hiddenAt ??= Date.now();
  }

  // Staleness is time spent in the background, not time since the tab was
  // last shown: a quick tab switch after a long session must not refetch.
  private handleVisibility(): void {
    if (this.document.visibilityState !== 'visible') {
      this.markHidden();
      return;
    }
    const hiddenAt = this.hiddenAt;
    this.hiddenAt = null;
    if (hiddenAt !== null && Date.now() - hiddenAt >= RESUME_FRESHNESS_MS) {
      void this.resume();
    }
  }

  // Cycles first: a long-open tab may have crossed into a new cycle, and the
  // pages follow the cycle selection on their own.
  private async resume(): Promise<void> {
    await this.cycles.load();
    await this.activeRoute.refresh();
  }
}

export function registerActiveRouteRefresh(callback: () => void | Promise<void>): void {
  const activeRoute = inject(ActiveRouteRefreshService);
  const destroyRef = inject(DestroyRef);
  const unregister = activeRoute.register(callback);
  destroyRef.onDestroy(unregister);
}
