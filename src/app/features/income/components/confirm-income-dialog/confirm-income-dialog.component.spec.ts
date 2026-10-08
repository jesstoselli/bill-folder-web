import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { IncomeEntryResponse } from '../../income.models';
import { IncomeStore } from '../../income.store';
import { ConfirmIncomeDialogComponent } from './confirm-income-dialog.component';

describe('ConfirmIncomeDialogComponent', () => {
  it('sends received status with the entered actual amount and date once', async () => {
    const pending = deferred<IncomeEntryResponse>();
    const confirmReceived = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(confirmReceived, dialogRef);
    const component = fixture.componentInstance;
    component.form.setValue({ actualAmount: 248.75, actualDate: '2026-10-19' });

    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();

    expect(confirmReceived).toHaveBeenCalledTimes(1);
    expect(confirmReceived).toHaveBeenCalledWith('income-1', {
      status: 'received',
      actualAmount: 248.75,
      actualDate: '2026-10-19',
    });
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    pending.resolve({
      ...income,
      status: 'received',
      actualAmount: 248.75,
      actualDate: '2026-10-19',
    });
    await Promise.all([first, duplicate]);
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('retains entered values and error after a failed confirmation', async () => {
    const confirmReceived = vi.fn(() =>
      Promise.reject({ status: 409, code: 'conflict', message: 'Confirmação recusada.' }),
    );
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(confirmReceived, dialogRef);
    const component = fixture.componentInstance;
    component.form.setValue({ actualAmount: 251.25, actualDate: '2026-10-20' });

    await component.submit();
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      actualAmount: 251.25,
      actualDate: '2026-10-20',
    });
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Confirmação recusada.',
    );
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});

async function createFixture(
  confirmReceived: ReturnType<typeof vi.fn>,
  dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean },
) {
  await TestBed.configureTestingModule({
    imports: [ConfirmIncomeDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { entry: income } },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: IncomeStore, useValue: { confirmReceived } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConfirmIncomeDialogComponent);
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

const income: IncomeEntryResponse = {
  id: 'income-1',
  sourceId: null,
  sourceOrigin: null,
  expectedAmount: 250,
  actualAmount: null,
  expectedDate: '2026-10-18',
  actualDate: null,
  status: 'expected',
  notes: null,
  createdAt: '',
  updatedAt: '',
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
