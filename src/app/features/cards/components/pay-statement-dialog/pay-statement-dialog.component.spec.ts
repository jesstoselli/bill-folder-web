import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CheckingAccountsApi } from '../../../../core/checking-accounts/checking-accounts.api';
import { ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { CardStatementDetailResponse } from '../../cards.models';
import { CardsStore } from '../../cards.store';
import { PayStatementDialogComponent } from './pay-statement-dialog.component';

describe('PayStatementDialogComponent', () => {
  it.each(['open', 'paid'] as const)('does not submit a %s statement', async (status) => {
    const payStatement = vi.fn();
    const fixture = await createFixture(statement({ status }), payStatement);

    await fixture.componentInstance.submit();

    expect(payStatement).not.toHaveBeenCalled();
  });

  it('blocks duplicate submits and sends the exact payment body for a closed statement', async () => {
    const pending = deferred<unknown>();
    const payStatement = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(statement({ status: 'closed' }), payStatement, dialogRef);
    const component = fixture.componentInstance;
    component.form.setValue({
      actualAmount: 398.5,
      paidDate: '2026-10-08',
      paidFromAccountId: null,
    });

    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();

    expect(payStatement).toHaveBeenCalledTimes(1);
    expect(payStatement).toHaveBeenCalledWith('statement-1', {
      actualAmount: 398.5,
      paidDate: '2026-10-08',
      paidFromAccountId: null,
    });
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Fechar').disabled).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    pending.resolve({ id: 'statement-1', status: 'paid' });
    await Promise.all([first, duplicate]);
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('keeps values, releases dismissal and does not close after a failed write', async () => {
    const pending = deferred<unknown>();
    const payStatement = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(statement({ status: 'closed' }), payStatement, dialogRef);
    const component = fixture.componentInstance;
    component.form.setValue({
      actualAmount: 401.25,
      paidDate: '2026-10-09',
      paidFromAccountId: 'account-1',
    });

    const submitting = component.submit();
    pending.reject({ status: 400, code: 'invalid_account', message: 'Conta inválida.' });
    await submitting;
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      actualAmount: 401.25,
      paidDate: '2026-10-09',
      paidFromAccountId: 'account-1',
    });
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Conta inválida.',
    );
  });
});

async function createFixture(
  value: CardStatementDetailResponse,
  payStatement: ReturnType<typeof vi.fn>,
  dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean } = {
    close: vi.fn(),
    disableClose: false,
  },
) {
  await TestBed.configureTestingModule({
    imports: [PayStatementDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { statement: value } },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: CardsStore, useValue: { payStatement } },
      { provide: ReferenceDataApi, useValue: { categories: () => of([]) } },
      {
        provide: CheckingAccountsApi,
        useValue: {
          list: () =>
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
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PayStatementDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function statement(overrides: Partial<CardStatementDetailResponse>): CardStatementDetailResponse {
  return {
    id: 'statement-1',
    cardId: 'card-1',
    cardName: 'Nubank',
    periodStart: '2026-09-04',
    periodEnd: '2026-10-03',
    dueDate: '2026-10-10',
    status: 'closed',
    paidDate: null,
    actualAmount: null,
    paidFromAccountId: null,
    paidFromAccountName: null,
    totalAmount: 400,
    linkedExpenseId: null,
    createdAt: '',
    updatedAt: '',
    installments: [],
    ...overrides,
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
