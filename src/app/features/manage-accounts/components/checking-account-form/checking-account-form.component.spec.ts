import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CheckingAccountResponse } from '../../../../core/checking-accounts/checking-account.models';
import { ManageAccountsStore } from '../../manage-accounts.store';
import {
  CheckingAccountFormComponent,
  CheckingAccountFormDialogData,
} from './checking-account-form.component';

describe('CheckingAccountFormComponent', () => {
  it('starts create mode with zero balance and no primary flag', async () => {
    const component = await createComponent();

    expect(component.form.getRawValue()).toEqual({
      bankName: '',
      branch: '',
      accountNumber: '',
      initialBalance: 0,
      isPrimary: false,
    });
  });

  it('prefills edit mode including primary state', async () => {
    const component = await createComponent({ mode: 'edit', account: primaryAccount });

    expect(component.form.getRawValue()).toEqual({
      bankName: 'Banco Verde',
      branch: '0001',
      accountNumber: '12345-6',
      initialBalance: 1250.5,
      isPrimary: true,
    });
  });

  it('rejects blank bank, branch, account number and negative balance', async () => {
    const component = await createComponent();
    component.form.setValue({
      bankName: '   ',
      branch: ' ',
      accountNumber: '\t',
      initialBalance: -0.01,
      isPrimary: false,
    });

    expect(component.form.controls.bankName.errors).toMatchObject({ blank: true });
    expect(component.form.controls.branch.errors).toMatchObject({ blank: true });
    expect(component.form.controls.accountNumber.errors).toMatchObject({ blank: true });
    expect(component.form.controls.initialBalance.errors).toMatchObject({ min: expect.anything() });
    expect(component.form.invalid).toBe(true);
  });

  it('trims text and sends a complete create request', async () => {
    const create = vi.fn(() => Promise.resolve(primaryAccount));
    const component = await createComponent({ create });
    component.form.setValue({
      bankName: '  Banco Verde  ',
      branch: '  0001 ',
      accountNumber: ' 12345-6  ',
      initialBalance: 1250.5,
      isPrimary: true,
    });

    await component.submit();

    expect(create).toHaveBeenCalledWith({
      bankName: 'Banco Verde',
      branch: '0001',
      accountNumber: '12345-6',
      initialBalance: 1250.5,
      isPrimary: true,
    });
  });

  it('sends a partial-compatible update request with every editable field', async () => {
    const update = vi.fn(() => Promise.resolve(primaryAccount));
    const component = await createComponent({
      data: { mode: 'edit', account: primaryAccount },
      update,
    });
    component.form.setValue({
      bankName: ' Banco Novo ',
      branch: ' 1234 ',
      accountNumber: ' 987-0 ',
      initialBalance: 900,
      isPrimary: false,
    });

    await component.submit();

    expect(update).toHaveBeenCalledWith('account-1', {
      bankName: 'Banco Novo',
      branch: '1234',
      accountNumber: '987-0',
      initialBalance: 900,
      isPrimary: false,
    });
  });

  it('prevents a second submit while the first request is pending', async () => {
    const pending = deferred<CheckingAccountResponse>();
    const create = vi.fn(() => pending.promise);
    const component = await createComponent({ create });
    component.form.setValue({
      bankName: 'Banco Verde',
      branch: '0001',
      accountNumber: '12345-6',
      initialBalance: 0,
      isPrimary: false,
    });

    const first = component.submit();
    const second = component.submit();
    expect(create).toHaveBeenCalledTimes(1);

    pending.resolve(primaryAccount);
    await Promise.all([first, second]);
  });
});

async function createComponent(
  options:
    | CheckingAccountFormDialogData
    | {
        data?: CheckingAccountFormDialogData;
        create?: ReturnType<typeof vi.fn>;
        update?: ReturnType<typeof vi.fn>;
      } = {},
) {
  const normalized = 'mode' in options ? { data: options } : options;
  await TestBed.configureTestingModule({
    imports: [CheckingAccountFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: normalized.data ?? { mode: 'create' } },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
      {
        provide: ManageAccountsStore,
        useValue: {
          create: normalized.create ?? vi.fn(() => Promise.resolve(primaryAccount)),
          update: normalized.update ?? vi.fn(() => Promise.resolve(primaryAccount)),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CheckingAccountFormComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const primaryAccount: CheckingAccountResponse = {
  id: 'account-1',
  bankName: 'Banco Verde',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 1250.5,
  isPrimary: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};
