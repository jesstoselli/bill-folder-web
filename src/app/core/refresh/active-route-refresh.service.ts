import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal, untracked } from '@angular/core';
import { CycleStore } from '../cycles/cycle.store';

export const RESUME_FRESHNESS_MS = 5 * 60 * 1_000;

/** What a page shows; its store, in practice. */
export interface RefreshTarget {
  refresh(): void | Promise<void>;
}

/**
 * Knows which store the current page shows. Stores use it to reload after a
 * write only while on screen; a hidden store stays stale until its page is
 * shown again, so one write costs one request instead of one per visited page.
 */
@Injectable({ providedIn: 'root' })
export class ActiveRouteRefreshService {
  private readonly target = signal<RefreshTarget | null>(null);
  private inFlight: Promise<void> | null = null;

  register(target: RefreshTarget): () => void {
    this.target.set(target);
    return () => {
      if (this.target() === target) this.target.set(null);
    };
  }

  /**
   * Reactive. With no page registered (sign-in screens, isolated tests) every
   * store counts as visible, so nothing is left stale by accident.
   */
  isVisible(owner: object): boolean {
    const target = this.target();
    return target === null || target === owner;
  }

  /** Whether `owner` is exactly what the current page registered. */
  isShowing(owner: object): boolean {
    return untracked(this.target) === owner;
  }

  refresh(): Promise<void> {
    const target = untracked(this.target);
    if (!target) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = Promise.resolve(target.refresh())
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
    // On the cycles page the page's store is the cycle store just reloaded.
    if (!this.activeRoute.isShowing(this.cycles)) {
      await this.activeRoute.refresh();
    }
  }
}

/** Call in a page constructor with the store the page shows. */
export function registerActiveRouteRefresh(target: RefreshTarget): void {
  const activeRoute = inject(ActiveRouteRefreshService);
  const destroyRef = inject(DestroyRef);
  const unregister = activeRoute.register(target);
  destroyRef.onDestroy(unregister);
}
