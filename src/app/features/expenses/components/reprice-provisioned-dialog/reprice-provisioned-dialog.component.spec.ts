import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ExpensesStore } from '../../expenses.store';
import { RepriceProvisionedDialogComponent } from './reprice-provisioned-dialog.component';

describe('RepriceProvisionedDialogComponent', () => {
  it('describes per-session repricing, restores dismissal and retains failures', async () => {
    let rejectReprice: (reason: unknown) => void = () => undefined;
    const repriceProvisioned = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectReprice = reject;
        }),
    );
    const dialogRef = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({
      imports: [RepriceProvisionedDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            expense: {
              id: 'expense-1',
              label: 'Terapia',
              occurrenceAmount: 150,
              occurrencesTotal: 4,
              expectedAmount: 600,
            },
            scope: 'thisAndFollowing',
          },
        },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: ExpensesStore, useValue: { repriceProvisioned } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RepriceProvisionedDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.amount.setValue(175);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('por sessão');
    expect(fixture.nativeElement.textContent).toMatch(/R\$\s*700,00/);
    const submitting = component.submit();
    fixture.detectChanges();

    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Fechar').disabled).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    rejectReprice({ status: 400, code: 'validation_error', message: 'Valor recusado.' });
    await submitting;
    fixture.detectChanges();

    expect(repriceProvisioned).toHaveBeenCalledWith('expense-1', {
      amount: 175,
      scope: 'thisAndFollowing',
    });
    expect(component.form.controls.amount.value).toBe(175);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Valor recusado.',
    );
    expect(dialogRef.disableClose).toBe(false);
    expect(findButton(fixture.nativeElement, 'Fechar').disabled).toBe(false);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
    findButton(fixture.nativeElement, 'Cancelar').click();
    expect(dialogRef.close).toHaveBeenCalledWith('');
  });
});

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}
