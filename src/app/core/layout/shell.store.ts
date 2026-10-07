import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type ShellMode = 'full' | 'rail' | 'drawer';

export const SHELL_BREAKPOINTS = {
  full: '(min-width: 1200px)',
  rail: '(min-width: 768px) and (max-width: 1199.98px)',
  drawer: '(max-width: 767.98px)',
} as const;

@Injectable({ providedIn: 'root' })
export class ShellStore {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly modeState = signal<ShellMode>('full');
  private readonly drawerOpenState = signal(false);

  readonly mode: Signal<ShellMode> = this.modeState.asReadonly();
  readonly drawerOpen = this.drawerOpenState.asReadonly();

  constructor() {
    this.breakpointObserver
      .observe([SHELL_BREAKPOINTS.full, SHELL_BREAKPOINTS.rail, SHELL_BREAKPOINTS.drawer])
      .pipe(takeUntilDestroyed())
      .subscribe((state) => this.applyBreakpoint(state));
  }

  setMode(mode: ShellMode): void {
    this.modeState.set(mode);
    if (mode !== 'drawer') {
      this.drawerOpenState.set(false);
    }
  }

  openDrawer(): void {
    if (this.modeState() === 'drawer') {
      this.drawerOpenState.set(true);
    }
  }

  closeDrawer(): void {
    this.drawerOpenState.set(false);
  }

  navigationCompleted(): void {
    if (this.modeState() === 'drawer') {
      this.closeDrawer();
    }
  }

  private applyBreakpoint(state: BreakpointState): void {
    if (state.breakpoints[SHELL_BREAKPOINTS.drawer]) {
      this.setMode('drawer');
      return;
    }

    if (state.breakpoints[SHELL_BREAKPOINTS.rail]) {
      this.setMode('rail');
      return;
    }

    this.setMode('full');
  }
}
