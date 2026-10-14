import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PasswordToggleComponent } from './password-toggle.component';

@Component({
  imports: [PasswordToggleComponent],
  template: `<app-password-toggle [(visible)]="visible" />`,
})
class HostComponent {
  readonly visible = signal(false);
}

describe('PasswordToggleComponent', () => {
  it('toggles the visibility and says what the next click does', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(button.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Ocultar senha');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.type).toBe('button');
  });
});
