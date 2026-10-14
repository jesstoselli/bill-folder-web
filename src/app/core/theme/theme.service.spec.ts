import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  function setup(systemIsDark = true) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    const query = {
      matches: systemIsDark,
      addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => (listener = fn),
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => query });
    const service = TestBed.inject(ThemeService);
    return {
      service,
      meta,
      changeSystem: (dark: boolean) => listener?.({ matches: dark } as MediaQueryListEvent),
    };
  }

  it('follows the system by default and pins nothing on <html>', () => {
    const { service, meta } = setup(false);

    expect(service.mode()).toBe('system');
    expect(service.isDark()).toBe(false);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(meta.content).toBe('#f8faf1');
  });

  it('applies and remembers an explicit choice', () => {
    const { service, meta } = setup(true);

    service.setMode('light');
    TestBed.tick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(meta.content).toBe('#f8faf1');
  });

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { service } = setup(false);

    expect(service.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('going back to Automático forgets the choice and tracks the system', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { service, changeSystem } = setup(false);

    service.setMode('system');
    TestBed.tick();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    changeSystem(true);
    expect(service.isDark()).toBe(true);
  });
});
