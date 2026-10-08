import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SavingsTransactionResponse } from '../../savings.models';
import { SavingsStore } from '../../savings.store';
import {
  SavingsTransactionFormComponent,
  SavingsTransactionFormDialogData,
} from './savings-transaction-form.component';

describe('SavingsTransactionFormComponent', () => {
  it('sends the exact account, type literals and optional link contract on create', async () => {
    const createTransaction = vi.fn(() => Promise.resolve(savedTransaction));
    const component = await createComponent({ createTransaction });
    component.form.setValue({
      type: 'withdrawal',
      amount: 125.5,
      date: '2026-10-20',
      label: '  Fundo de emergência  ',
      linkedTransactionId: '  linked-transaction  ',
    });

    await component.submit();

    expect(createTransaction).toHaveBeenCalledWith({
      savingsAccountId: 'savings-1',
      type: 'withdrawal',
      amount: 125.5,
      date: '2026-10-20',
      label: 'Fundo de emergência',
      linkedTransactionId: 'linked-transaction',
    });
  });

  it('maps blank optional fields to null instead of inventing checking-account data', async () => {
    const createTransaction = vi.fn(() => Promise.resolve(savedTransaction));
    const component = await createComponent({ createTransaction });
    component.form.setValue({
      type: 'deposit',
      amount: 300,
      date: '2026-10-21',
      label: '   ',
      linkedTransactionId: '   ',
    });

    await component.submit();

    expect(createTransaction).toHaveBeenCalledWith({
      savingsAccountId: 'savings-1',
      type: 'deposit',
      amount: 300,
      date: '2026-10-21',
      label: null,
      linkedTransactionId: null,
    });
  });

  it('retains values and errors while locking duplicate submit and dismissal during save', async () => {
    const pending = deferred<SavingsTransactionResponse>();
    const createTransaction = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture({ createTransaction, dialogRef });
    const component = fixture.componentInstance;
    const entered = {
      type: 'deposit' as const,
      amount: 400,
      date: '2026-10-22',
      label: 'Reserva',
      linkedTransactionId: '',
    };
    component.form.setValue(entered);

    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    pending.reject({ status: 400, code: 'validation_error', message: 'Movimento inválido.' });
    await Promise.all([first, duplicate]);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual(entered);
    expect(component.serverError()).toBe('Movimento inválido.');
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('updates only the editable transaction DTO fields', async () => {
    const updateTransaction = vi.fn(() => Promise.resolve(savedTransaction));
    const component = await createComponent({
      updateTransaction,
      data: { mode: 'edit', accountId: 'savings-1', transaction: savedTransaction },
    });
    component.form.patchValue({ amount: 440, label: 'Reserva revista' });

    await component.submit();

    expect(updateTransaction).toHaveBeenCalledWith('transaction-1', {
      type: 'deposit',
      amount: 440,
      date: '2026-10-18',
      label: 'Reserva revista',
      linkedTransactionId: null,
    });
  });
});

async function createComponent(options: Parameters<typeof createFixture>[0] = {}) {
  return (await createFixture(options)).componentInstance;
}

async function createFixture(
  options: {
    createTransaction?: ReturnType<typeof vi.fn>;
    updateTransaction?: ReturnType<typeof vi.fn>;
    dialogRef?: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
    data?: SavingsTransactionFormDialogData;
  } = {},
) {
  const dialogRef = options.dialogRef ?? { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [SavingsTransactionFormComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: options.data ?? { mode: 'create', accountId: 'savings-1' },
      },
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: SavingsStore,
        useValue: {
          createTransaction:
            options.createTransaction ?? vi.fn(() => Promise.resolve(savedTransaction)),
          updateTransaction:
            options.updateTransaction ?? vi.fn(() => Promise.resolve(savedTransaction)),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SavingsTransactionFormComponent);
  fixture.detectChanges();
  return fixture;
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const savedTransaction: SavingsTransactionResponse = {
  id: 'transaction-1',
  savingsAccountId: 'savings-1',
  type: 'deposit',
  amount: 400,
  date: '2026-10-18',
  label: 'Reserva',
  linkedTransactionId: null,
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:00:00Z',
};
