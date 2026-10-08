import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { IncomeApi } from '../../income.api';
import { IncomeEntryResponse, IncomeSourceResponse } from '../../income.models';
import { IncomeStore } from '../../income.store';
import { IncomeEntryFormComponent } from './income-entry-form.component';

describe('IncomeEntryFormComponent', () => {
  it('loads active sources for the dropdown and creates avulso with null source exactly', async () => {
    const create = vi.fn(() => Promise.resolve(income()));
    const source = incomeSource();
    const component = await createComponent({ create, sources: [source] });

    expect(component.sources()).toEqual([source]);
    component.form.setValue({
      sourceId: null,
      expectedAmount: 250,
      expectedDate: '2026-10-18',
      notes: '  Projeto pontual  ',
    });
    await component.submit();

    expect(create).toHaveBeenCalledWith({
      sourceId: null,
      expectedAmount: 250,
      expectedDate: '2026-10-18',
      notes: 'Projeto pontual',
    });
  });

  it('keeps values and error, locks dismissal and blocks duplicate submits while saving', async () => {
    const pending = deferred<IncomeEntryResponse>();
    const create = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture({ create, dialogRef });
    const component = fixture.componentInstance;
    const entered = {
      sourceId: 'source-1' as string | null,
      expectedAmount: 375.4,
      expectedDate: '2026-10-20',
      notes: 'Não apagar',
    };
    component.form.setValue(entered);

    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();

    expect(create).toHaveBeenCalledTimes(1);
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Fechar').disabled).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    pending.reject({ status: 400, code: 'invalid_source', message: 'Fonte inválida.' });
    await Promise.all([first, duplicate]);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual(entered);
    expect(component.serverError()).toBe('Fonte inválida.');
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('sends an empty notes string on edit so PATCH clears the existing note', async () => {
    const update = vi.fn(() => Promise.resolve(income({ notes: null })));
    const component = await createComponent({
      update,
      data: { mode: 'edit', entry: income({ notes: 'Apagar' }) },
    });
    component.form.patchValue({ notes: '   ' });

    await component.submit();

    expect(update).toHaveBeenCalledWith('income-1', {
      sourceId: null,
      expectedAmount: 250,
      expectedDate: '2026-10-18',
      notes: '',
    });
  });
});

async function createComponent(options: Parameters<typeof createFixture>[0] = {}) {
  return (await createFixture(options)).componentInstance;
}

async function createFixture(
  options: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    sources?: IncomeSourceResponse[];
    dialogRef?: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
    data?: { mode: 'create' } | { mode: 'edit'; entry: IncomeEntryResponse };
  } = {},
) {
  const dialogRef = options.dialogRef ?? { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [IncomeEntryFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: options.data ?? { mode: 'create' } },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: IncomeApi, useValue: { listSources: () => of(options.sources ?? []) } },
      {
        provide: IncomeStore,
        useValue: {
          create: options.create ?? vi.fn(() => Promise.resolve(income())),
          update: options.update ?? vi.fn(() => Promise.resolve(income())),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(IncomeEntryFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function income(overrides: Partial<IncomeEntryResponse> = {}): IncomeEntryResponse {
  return {
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
    ...overrides,
  };
}

function incomeSource(): IncomeSourceResponse {
  return {
    id: 'source-1',
    origin: 'Salário',
    originType: 'work',
    defaultAmount: 5000,
    expectedDay: 5,
    startDate: '2026-01-01',
    endDate: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
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
