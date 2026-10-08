import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { ExpensesStore } from '../../expenses.store';
import { PayExpenseDialogComponent } from './pay-expense-dialog.component';

describe('PayExpenseDialogComponent', () => {
  it('does not submit invalid payment values', async () => {
    const pay = vi.fn();
    const fixture = await createFixture(pay, vi.fn());
    const component = fixture.componentInstance;
    component.form.patchValue({ actualAmount: 0, paidDate: '2026-02-31' });

    await component.submit();

    expect(pay).not.toHaveBeenCalled();
  });

  it('blocks duplicate submits and sends the exact entered payment values', async () => {
    let resolvePayment: (value: unknown) => void = () => undefined;
    const pay = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePayment = resolve;
        }),
    );
    const close = vi.fn();
    const fixture = await createFixture(pay, close);
    const component = fixture.componentInstance;
    component.form.setValue({
      actualAmount: 118.5,
      paidDate: '2026-10-12',
      paidFromAccountId: 'account-1',
    });

    const first = component.submit();
    const duplicate = component.submit();

    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith('expense-1', {
      actualAmount: 118.5,
      paidDate: '2026-10-12',
      paidFromAccountId: 'account-1',
    });
    resolvePayment({ id: 'expense-1' });
    await Promise.all([first, duplicate]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps entered values and shows the server error after failure', async () => {
    const pay = vi.fn(() =>
      Promise.reject({ status: 400, code: 'invalid_account', message: 'Conta inválida.' }),
    );
    const fixture = await createFixture(pay, vi.fn());
    const component = fixture.componentInstance;
    component.form.setValue({
      actualAmount: 117.25,
      paidDate: '2026-10-13',
      paidFromAccountId: 'account-2',
    });

    await component.submit();
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      actualAmount: 117.25,
      paidDate: '2026-10-13',
      paidFromAccountId: 'account-2',
    });
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Conta inválida.',
    );
  });
});

async function createFixture(pay: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [PayExpenseDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          expense: {
            id: 'expense-1',
            label: 'Internet',
            expectedAmount: 120,
          },
        },
      },
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: ReferenceDataApi,
        useValue: {
          checkingAccounts: () =>
            of([
              {
                id: 'account-1',
                bankName: 'Banco Um',
                branch: null,
                accountNumber: null,
                initialBalance: 0,
                isPrimary: true,
                createdAt: '',
                updatedAt: '',
              },
            ]),
        },
      },
      { provide: ExpensesStore, useValue: { pay } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PayExpenseDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}
