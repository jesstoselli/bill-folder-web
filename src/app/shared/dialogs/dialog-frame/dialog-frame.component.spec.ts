import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { DialogFrameComponent } from './dialog-frame.component';

@Component({
  imports: [DialogFrameComponent],
  template: `
    <form (submit)="$event.preventDefault()">
      <app-dialog-frame
        titleId="pay-title"
        heading="Registrar pagamento"
        closeLabel="Fechar pagamento"
        [saving]="saving()"
        [error]="error()"
        submitLabel="Registrar pagamento"
        savingLabel="Registrando…"
        [submitDisabled]="loading()"
      >
        <p dialogSubtitle id="pay-description">Internet</p>
        <label>Valor <input name="amount" /></label>
      </app-dialog-frame>
    </form>
  `,
})
class HostComponent {
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
}

describe('DialogFrameComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialogRef, useValue: { close: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const submit = () => root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    return { fixture, root, submit };
  }

  it('labels the dialog title and projects the subtitle and fields', () => {
    const { root } = setup();

    expect(root.querySelector('h2#pay-title')?.textContent?.trim()).toBe('Registrar pagamento');
    expect(root.querySelector('header #pay-description')?.textContent).toBe('Internet');
    expect(root.querySelector('mat-dialog-content input[name="amount"]')).not.toBeNull();
    expect(root.querySelector('button[aria-label="Fechar pagamento"]')).not.toBeNull();
  });

  it('locks every action and swaps the submit label while saving', () => {
    const { fixture, root, submit } = setup();
    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();

    expect(submit().textContent?.trim()).toBe('Registrando…');
    expect(
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).every((b) => b.disabled),
    ).toBe(true);
  });

  it('disables only submit while references load', () => {
    const { fixture, root, submit } = setup();
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    expect(submit().disabled).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('button[aria-label="Fechar pagamento"]')?.disabled,
    ).toBe(false);
  });

  it('shows the server error as an alert inside the content', () => {
    const { fixture, root } = setup();
    fixture.componentInstance.error.set('Saldo insuficiente.');
    fixture.detectChanges();

    expect(root.querySelector('mat-dialog-content [role="alert"]')?.textContent).toContain(
      'Saldo insuficiente.',
    );
  });
});
