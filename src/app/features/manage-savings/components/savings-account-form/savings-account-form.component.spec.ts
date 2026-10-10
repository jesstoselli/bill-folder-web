import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CheckingAccountResponse } from '../../../../core/checking-accounts/checking-account.models';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { SavingsAccountResponse } from '../../../savings/savings.models';
import { ManageSavingsStore } from '../../manage-savings.store';
import {
  SavingsAccountFormComponent,
  SavingsAccountFormDialogData,
} from './savings-account-form.component';

describe('SavingsAccountFormComponent', () => {
  it('offers only checking accounts without savings, defaulting to the first one', async () => {
    const { component } = await setup(
      { mode: 'create' },
      [primary, secondary],
      [savingsOf(primary)],
    );

    expect(component.availableAccounts().map((account) => account.id)).toEqual(['secondary']);
    expect(component.form.controls.checkingAccountId.value).toBe('secondary');
  });

  it('copies the bank data of the chosen checking account on create', async () => {
    const { component, store, dialogRef } = await setup({ mode: 'create' }, [primary]);
    component.form.controls.initialBalance.setValue(150.5);

    await component.submit();

    expect(store.create).toHaveBeenCalledWith({
      checkingAccountId: 'primary',
      bankName: 'Banco Verde',
      branch: '0001',
      accountNumber: '12345-6',
      initialBalance: 150.5,
    });
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('blocks a checking account without branch or number', async () => {
    const incomplete = { ...primary, branch: null };
    const { component, store } = await setup({ mode: 'create' }, [incomplete]);

    await component.submit();

    expect(component.form.controls.checkingAccountId.hasError('incompleteAccount')).toBe(true);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('explains when every checking account already has savings', async () => {
    const { element } = await setup({ mode: 'create' }, [primary], [savingsOf(primary)]);

    expect(element.textContent).toContain(
      'Todas as contas-correntes já têm uma poupança vinculada',
    );
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it('only changes the initial balance on edit and keeps the link read-only', async () => {
    const account = savingsOf(primary);
    const { component, element, store } = await setup({ mode: 'edit', account }, [primary]);
    component.form.controls.initialBalance.setValue(80);

    await component.submit();

    expect(element.querySelector('mat-select')).toBeNull();
    expect(element.textContent).toContain('Banco Verde · 12345-6');
    expect(store.update).toHaveBeenCalledWith('savings-primary', { initialBalance: 80 });
  });
});

async function setup(
  data: SavingsAccountFormDialogData,
  checking: CheckingAccountResponse[],
  savings: SavingsAccountResponse[] = [],
) {
  const store = {
    accounts: signal(savings).asReadonly(),
    create: vi.fn(() => Promise.resolve(savingsOf(primary))),
    update: vi.fn(() => Promise.resolve(savingsOf(primary))),
  };
  const dialogRef = { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [SavingsAccountFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: ManageSavingsStore, useValue: store },
      {
        provide: ReferenceDataStore,
        useValue: { checkingAccounts: () => Promise.resolve(checking) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SavingsAccountFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
    store,
    dialogRef,
  };
}

const primary: CheckingAccountResponse = {
  id: 'primary',
  bankName: 'Banco Verde',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 0,
  isPrimary: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const secondary: CheckingAccountResponse = {
  ...primary,
  id: 'secondary',
  bankName: 'Banco Roxo',
  isPrimary: false,
};

function savingsOf(checking: CheckingAccountResponse): SavingsAccountResponse {
  return {
    id: `savings-${checking.id}`,
    checkingAccountId: checking.id,
    bankName: checking.bankName,
    branch: checking.branch ?? '',
    accountNumber: checking.accountNumber ?? '',
    initialBalance: 100,
    currentBalance: 250,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };
}
