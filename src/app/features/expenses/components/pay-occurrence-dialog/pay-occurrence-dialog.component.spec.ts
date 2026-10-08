import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { ExpensesStore } from '../../expenses.store';
import { PayOccurrenceDialogComponent } from './pay-occurrence-dialog.component';

describe('PayOccurrenceDialogComponent', () => {
  it('prefills the session amount and preserves values when payment fails', async () => {
    const payOccurrence = vi.fn(() =>
      Promise.reject({ status: 400, code: 'invalid_account', message: 'Conta inválida.' }),
    );
    const fixture = await createFixture(payOccurrence);
    const component = fixture.componentInstance;

    expect(component.form.controls.amount.value).toBe(150);
    component.form.setValue({
      amount: 155,
      paidDate: '2026-10-14',
      paidFromAccountId: 'account-1',
    });
    await component.submit();
    fixture.detectChanges();

    expect(payOccurrence).toHaveBeenCalledWith('expense-1', {
      amount: 155,
      paidDate: '2026-10-14',
      paidFromAccountId: 'account-1',
    });
    expect(component.form.getRawValue()).toEqual({
      amount: 155,
      paidDate: '2026-10-14',
      paidFromAccountId: 'account-1',
    });
    expect(fixture.nativeElement.textContent).toContain('1 de 4 pagas');
    expect(fixture.nativeElement.textContent).toMatch(/R\$\s*450,00/);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Conta inválida.',
    );
  });

  it('blocks duplicate occurrence submissions while saving', async () => {
    let resolvePayment: (value: unknown) => void = () => undefined;
    const payOccurrence = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePayment = resolve;
        }),
    );
    const fixture = await createFixture(payOccurrence);
    const component = fixture.componentInstance;
    component.form.patchValue({ paidDate: '2026-10-14' });

    const first = component.submit();
    const duplicate = component.submit();
    expect(payOccurrence).toHaveBeenCalledTimes(1);
    resolvePayment({ id: 'expense-1' });
    await Promise.all([first, duplicate]);
  });
});

async function createFixture(payOccurrence: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [PayOccurrenceDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          expense: {
            id: 'expense-1',
            label: 'Terapia',
            occurrenceAmount: 150,
            occurrencesTotal: 4,
            occurrencesPaid: 1,
            paidToDate: 150,
            expectedAmount: 600,
          },
        },
      },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: ReferenceDataApi, useValue: { checkingAccounts: () => of([]) } },
      { provide: ExpensesStore, useValue: { payOccurrence } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PayOccurrenceDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}
