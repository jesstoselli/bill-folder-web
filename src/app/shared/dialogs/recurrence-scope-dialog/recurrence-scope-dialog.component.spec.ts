import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RecurrenceScopeDialogComponent } from './recurrence-scope-dialog.component';

describe('RecurrenceScopeDialogComponent', () => {
  it('renders two full-width choices with explicit delete consequences', async () => {
    const close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [RecurrenceScopeDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { action: 'delete', expenseLabel: 'Terapia' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecurrenceScopeDialogComponent);
    fixture.detectChanges();
    const choices = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.recurrence-scope__choice',
    );

    expect(choices).toHaveLength(2);
    expect(choices[0].textContent).toContain('Somente esta');
    expect(choices[0].textContent).toContain('mantém as próximas');
    expect(choices[1].textContent).toContain('Esta e as próximas');
    expect(choices[1].textContent).toContain('encerra a recorrência');

    choices[1].click();
    expect(close).toHaveBeenCalledWith('thisAndFollowing');
  });

  it('cancels without a scope, so callers do not go on to the next step', async () => {
    const close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [RecurrenceScopeDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { action: 'reprice', expenseLabel: 'Diarista' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RecurrenceScopeDialogComponent);
    fixture.detectChanges();
    const cancel = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Cancelar');
    cancel?.click();

    expect(close).toHaveBeenCalledOnce();
    expect(close.mock.calls[0][0]).toBeUndefined();
  });
});
