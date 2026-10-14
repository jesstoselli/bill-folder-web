import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

/** The appearance chosen on this device; "system" follows the OS. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bf-theme';

/** Browser chrome colour (status bar, title bar) per resolved theme. */
const THEME_COLOR = { dark: '#0a0d0a', light: '#f8faf1' } as const;

/**
 * Applies the appearance picked in "Sua conta". The choice belongs to the
 * device, like on Android: it is kept in localStorage and survives logout.
 * `data-theme` on <html> pins the tokens in styles/_tokens.scss; without it
 * they follow prefers-color-scheme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemQuery = this.document.defaultView?.matchMedia?.(
    '(prefers-color-scheme: dark)',
  );
  private readonly modeState = signal<ThemeMode>(this.readStoredMode());
  private readonly systemIsDark = signal(this.systemQuery?.matches ?? true);

  readonly mode = this.modeState.asReadonly();
  readonly isDark = computed(() => {
    const mode = this.modeState();
    return mode === 'system' ? this.systemIsDark() : mode === 'dark';
  });

  constructor() {
    const onSystemChange = (event: MediaQueryListEvent) => this.systemIsDark.set(event.matches);
    this.systemQuery?.addEventListener?.('change', onSystemChange);
    inject(DestroyRef).onDestroy(() =>
      this.systemQuery?.removeEventListener?.('change', onSystemChange),
    );

    // Applied right away too: app initializers (session restore) can hold the
    // first change detection, and the page would show the system theme.
    this.apply(this.modeState(), this.isDark());
    effect(() => this.apply(this.modeState(), this.isDark()));
  }

  setMode(mode: ThemeMode): void {
    this.modeState.set(mode);
    try {
      if (mode === 'system') {
        this.document.defaultView?.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    } catch {
      // Private mode or blocked storage: the choice still applies this session.
    }
  }

  private apply(mode: ThemeMode, isDark: boolean): void {
    const root = this.document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? THEME_COLOR.dark : THEME_COLOR.light);
  }

  private readStoredMode(): ThemeMode {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
