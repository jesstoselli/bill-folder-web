import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ExpensesStore } from '../../expenses.store';
import { RepriceProvisionedDialogComponent } from './reprice-provisioned-dialog.component';

describe('RepriceProvisionedDialogComponent', () => {
  it('describes per-session repricing, recalculates month context and retains failures', async () => {
    const repriceProvisioned = vi.fn(() =>
      Promise.reject({ status: 400, code: 'validation_error', message: 'Valor recusado.' }),
    );
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
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
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
    await component.submit();
    fixture.detectChanges();

    expect(repriceProvisioned).toHaveBeenCalledWith('expense-1', {
      amount: 175,
      scope: 'thisAndFollowing',
    });
    expect(component.form.controls.amount.value).toBe(175);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Valor recusado.',
    );
  });
});
