import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CycleAdjustmentResponse } from '../../adjustments.models';
import { AdjustmentsStore } from '../../adjustments.store';
import { AdjustmentFormComponent } from './adjustment-form.component';

describe('AdjustmentFormComponent', () => {
  it('sends the exact plain inflow/outflow contract and null source transaction', async () => {
    const create = vi.fn(() => Promise.resolve(adjustment));
    const component = await createComponent({ create });
    component.form.setValue({
      type: 'inflow',
      label: '  Reembolso  ',
      amount: 72.5,
      date: '2026-10-18',
    });
    await component.submit();
    expect(create).toHaveBeenCalledWith({
      type: 'inflow',
      label: 'Reembolso',
      amount: 72.5,
      date: '2026-10-18',
      sourceSavingsTransactionId: null,
    });
  });

  it('retains values and error, locks dismissal and prevents duplicate submits', async () => {
    const pending = deferred<CycleAdjustmentResponse>();
    const create = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture({ create, dialogRef });
    const component = fixture.componentInstance;
    const entered = {
      type: 'outflow' as const,
      label: 'Correção',
      amount: 45.25,
      date: '2026-10-20',
    };
    component.form.setValue(entered);
    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();
    expect(create).toHaveBeenCalledTimes(1);
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);
    pending.reject({ status: 400, code: 'validation_error', message: 'Ajuste inválido.' });
    await Promise.all([first, duplicate]);
    fixture.detectChanges();
    expect(component.form.getRawValue()).toEqual(entered);
    expect(component.serverError()).toBe('Ajuste inválido.');
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});

async function createComponent(options: Parameters<typeof createFixture>[0] = {}) {
  return (await createFixture(options)).componentInstance;
}
async function createFixture(
  options: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    dialogRef?: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
    data?: { mode: 'create' } | { mode: 'edit'; adjustment: CycleAdjustmentResponse };
  } = {},
) {
  const dialogRef = options.dialogRef ?? { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [AdjustmentFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: options.data ?? { mode: 'create' } },
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: AdjustmentsStore,
        useValue: {
          create: options.create ?? vi.fn(() => Promise.resolve(adjustment)),
          update: options.update ?? vi.fn(() => Promise.resolve(adjustment)),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AdjustmentFormComponent);
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
const adjustment: CycleAdjustmentResponse = {
  id: 'adjustment-1',
  type: 'outflow',
  label: 'Acerto',
  amount: 40,
  date: '2026-10-12',
  sourceSavingsTransactionId: null,
  createdAt: '',
  updatedAt: '',
};
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
