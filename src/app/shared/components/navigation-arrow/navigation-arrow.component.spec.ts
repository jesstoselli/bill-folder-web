import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationArrowComponent } from './navigation-arrow.component';

@Component({
  imports: [NavigationArrowComponent],
  template: `
    <button type="button" appNavigationArrow direction="previous" aria-label="Anterior"></button>
    <button
      type="button"
      appNavigationArrow
      direction="next"
      aria-label="Próxima"
      disabled
    ></button>
  `,
})
class HostComponent {}

describe('NavigationArrowComponent', () => {
  it('renders centered chevrons for both directions', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );

    expect(buttons[0]?.querySelector('path')?.getAttribute('d')).toBe('m15 5-7 7 7 7');
    expect(buttons[1]?.querySelector('path')?.getAttribute('d')).toBe('m9 5 7 7-7 7');
  });

  it('preserves native labels and disabled semantics', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );

    expect(buttons[0]?.getAttribute('aria-label')).toBe('Anterior');
    expect(buttons[0]?.disabled).toBe(false);
    expect(buttons[1]?.getAttribute('aria-label')).toBe('Próxima');
    expect(buttons[1]?.disabled).toBe(true);
  });
});
