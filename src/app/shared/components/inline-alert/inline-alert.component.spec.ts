import { TestBed } from '@angular/core/testing';
import { InlineAlertComponent } from './inline-alert.component';

describe('InlineAlertComponent', () => {
  it('announces the message as an alert', () => {
    const fixture = TestBed.createComponent(InlineAlertComponent);
    fixture.componentRef.setInput('message', 'Não foi possível excluir.');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.hidden).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível excluir.',
    );
  });

  it('renders nothing and hides its host without a message', () => {
    const fixture = TestBed.createComponent(InlineAlertComponent);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.hidden).toBe(true);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
