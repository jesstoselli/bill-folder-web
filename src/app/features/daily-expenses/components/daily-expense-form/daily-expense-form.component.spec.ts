import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import {
  CategoryDto,
  CheckingAccountResponse,
  ReferenceDataApi,
} from '../../../../core/reference/reference-data.api';
import { DailyExpenseResponse } from '../../daily-expenses.models';
import { DailyExpensesStore } from '../../daily-expenses.store';
import { DailyExpenseFormComponent } from './daily-expense-form.component';
import {
  toCreateDailyExpenseRequest,
  toUpdateDailyExpenseRequest,
} from './daily-expense-form.models';

describe('daily expense form mapping', () => {
  const value = {
    date: '2026-10-18',
    label: '  Padaria  ',
    amount: 34.9,
    categoryId: 'category-1',
    accountId: 'account-1',
    notes: '  Café da manhã  ',
  };

  it('maps the exact create request and normalizes optional text', () => {
    expect(toCreateDailyExpenseRequest(value)).toEqual({
      date: '2026-10-18',
      label: 'Padaria',
      amount: 34.9,
      categoryId: 'category-1',
      accountId: 'account-1',
      notes: 'Café da manhã',
    });
    expect(toCreateDailyExpenseRequest({ ...value, notes: '   ' }).notes).toBeNull();
  });

  it('maps every editable field and keeps empty notes so PATCH clears them', () => {
    expect(toUpdateDailyExpenseRequest({ ...value, notes: '   ' })).toEqual({
      date: '2026-10-18',
      label: 'Padaria',
      amount: 34.9,
      categoryId: 'category-1',
      accountId: 'account-1',
      notes: '',
    });
  });
});

describe('DailyExpenseFormComponent', () => {
  it('sorts categories by display order and accounts with the primary account first', async () => {
    const component = await createComponent({
      categories: [
        category({ id: 'later', namePt: 'Transporte', displayOrder: 20 }),
        category({ id: 'alpha-b', namePt: 'Mercado', displayOrder: 10 }),
        category({ id: 'alpha-a', namePt: 'Alimentação', displayOrder: 10 }),
      ],
      accounts: [
        account({ id: 'secondary', bankName: 'Banco A', isPrimary: false }),
        account({ id: 'primary', bankName: 'Banco Z', isPrimary: true }),
      ],
    });

    await vi.waitFor(() => expect(component.loadingReferences()).toBe(false));

    expect(component.categories().map((item) => item.id)).toEqual(['alpha-a', 'alpha-b', 'later']);
    expect(component.accounts().map((item) => item.id)).toEqual(['primary', 'secondary']);
  });

  it('keeps entered values, the dialog and the server error after a failed save', async () => {
    const pending = deferred<DailyExpenseResponse>();
    const create = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const component = await createComponent({ create, dialogRef });
    component.form.setValue(validFormValue());

    const submission = component.submit();
    expect(component.saving()).toBe(true);
    expect(dialogRef.disableClose).toBe(true);

    pending.reject({ status: 400, code: 'invalid_account', message: 'Conta inválida.' });
    await submission;

    expect(component.form.getRawValue()).toEqual(validFormValue());
    expect(component.serverError()).toBe('Conta inválida.');
    expect(component.saving()).toBe(false);
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('blocks duplicate submits while saving and closes once with the saved row', async () => {
    const pending = deferred<DailyExpenseResponse>();
    const create = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const component = await createComponent({ create, dialogRef });
    component.form.setValue(validFormValue());

    const first = component.submit();
    const duplicate = component.submit();

    expect(create).toHaveBeenCalledTimes(1);
    expect(dialogRef.disableClose).toBe(true);
    pending.resolve(dailyExpense());
    await Promise.all([first, duplicate]);

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).toHaveBeenCalledWith(dailyExpense());
  });

  it('shows a reference-data error without clearing edit values', async () => {
    const edited = dailyExpense({
      date: '2026-10-12',
      label: 'Almoço',
      amount: 52,
      categoryId: 'category-edit',
      accountId: 'account-edit',
      notes: 'Com cliente',
    });
    const component = await createComponent({
      data: { mode: 'edit', expense: edited },
      referenceError: { status: 500, code: 'read_failed', message: 'Referências indisponíveis.' },
    });

    await vi.waitFor(() => expect(component.loadingReferences()).toBe(false));

    expect(component.form.getRawValue()).toEqual({
      date: '2026-10-12',
      label: 'Almoço',
      amount: 52,
      categoryId: 'category-edit',
      accountId: 'account-edit',
      notes: 'Com cliente',
    });
    expect(component.serverError()).toBe('Referências indisponíveis.');
  });
});

async function createComponent(
  options: {
    categories?: CategoryDto[];
    accounts?: CheckingAccountResponse[];
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    dialogRef?: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
    data?: { mode: 'create' } | { mode: 'edit'; expense: DailyExpenseResponse };
    referenceError?: unknown;
  } = {},
): Promise<DailyExpenseFormComponent> {
  const dialogRef = options.dialogRef ?? { close: vi.fn(), disableClose: false };
  const references = options.referenceError
    ? {
        categories: () => {
          throw options.referenceError;
        },
        checkingAccounts: () => of([]),
      }
    : {
        categories: () => of(options.categories ?? []),
        checkingAccounts: () => of(options.accounts ?? []),
      };

  await TestBed.configureTestingModule({
    imports: [DailyExpenseFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: options.data ?? { mode: 'create' } },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: ReferenceDataApi, useValue: references },
      {
        provide: DailyExpensesStore,
        useValue: {
          create: options.create ?? vi.fn(() => Promise.resolve(dailyExpense())),
          update: options.update ?? vi.fn(() => Promise.resolve(dailyExpense())),
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(DailyExpenseFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.componentInstance;
}

function validFormValue() {
  return {
    date: '2026-10-18',
    label: 'Padaria',
    amount: 34.9,
    categoryId: 'category-1',
    accountId: 'account-1',
    notes: 'Não apagar',
  };
}

function dailyExpense(overrides: Partial<DailyExpenseResponse> = {}): DailyExpenseResponse {
  return {
    id: 'daily-1',
    date: '2026-10-18',
    label: 'Padaria',
    amount: 34.9,
    categoryId: 'category-1',
    categoryName: 'Alimentação',
    accountId: 'account-1',
    accountName: 'Banco Principal',
    notes: null,
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z',
    ...overrides,
  };
}

function category(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return {
    id: 'category-1',
    key: 'food',
    namePt: 'Alimentação',
    isSystem: true,
    displayOrder: 10,
    ...overrides,
  };
}

function account(overrides: Partial<CheckingAccountResponse> = {}): CheckingAccountResponse {
  return {
    id: 'account-1',
    bankName: 'Banco Principal',
    branch: null,
    accountNumber: null,
    initialBalance: 0,
    isPrimary: true,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
