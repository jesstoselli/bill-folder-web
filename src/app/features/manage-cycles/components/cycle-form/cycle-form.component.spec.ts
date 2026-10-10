import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CycleResponse } from '../../../../core/cycles/cycle.models';
import { CycleStore } from '../../../../core/cycles/cycle.store';
import { CycleFormComponent, CycleFormDialogData, cycleDefaults } from './cycle-form.component';

describe('cycleDefaults', () => {
  it('defaults create mode to the current civil month and pt-BR lowercase label', () => {
    expect(cycleDefaults('2026-11-17')).toEqual({
      label: 'novembro/2026',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
  });
});

describe('CycleFormComponent', () => {
  it('prefills every field in edit mode', async () => {
    const component = await createComponent({ mode: 'edit', cycle: november });

    expect(component.form.getRawValue()).toEqual({
      label: 'novembro/2026',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
  });

  it('rejects blank label and end date not after start date', async () => {
    const component = await createComponent();
    component.form.setValue({
      label: '   ',
      startDate: '2026-11-30',
      endDate: '2026-11-30',
    });

    expect(component.form.controls.label.errors).toMatchObject({ blank: true });
    expect(component.form.errors).toEqual({ dateRange: true });
    expect(component.form.invalid).toBe(true);
  });

  it.each([
    ['equal', '2026-11-30', '2026-11-30'],
    ['inverted', '2026-11-30', '2026-11-01'],
  ])(
    'renders and associates the date range error after submitting %s dates',
    async (_case, startDate, endDateValue) => {
      const fixture = await createFixture();
      fixture.componentInstance.form.setValue({
        label: 'novembro/2026',
        startDate,
        endDate: endDateValue,
      });
      fixture.detectChanges();

      findButton(fixture.nativeElement, 'Salvar ciclo').click();
      await fixture.whenStable();
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const endDate = root.querySelector<HTMLInputElement>('[formcontrolname="endDate"]');
      const rangeError = [...root.querySelectorAll<HTMLElement>('mat-error')].find((error) =>
        error.textContent?.includes('A data final deve ser posterior à data inicial.'),
      );
      expect(rangeError).toBeTruthy();
      expect(endDate?.getAttribute('aria-describedby')?.split(' ')).toContain(rangeError?.id);
    },
  );

  it('submits the exact create request once while saving', async () => {
    const pending = deferred<CycleResponse>();
    const create = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const component = await createComponent({ create, dialogRef });
    component.form.setValue({
      label: '  dezembro/2026  ',
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    });

    const first = component.submit();
    const duplicate = component.submit();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      label: 'dezembro/2026',
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    });
    expect(dialogRef.disableClose).toBe(true);
    pending.resolve(december);
    await Promise.all([first, duplicate]);
    expect(dialogRef.close).toHaveBeenCalledOnce();
    expect(dialogRef.close).toHaveBeenCalledWith(december);
  });

  it('submits the exact patch request in edit mode', async () => {
    const update = vi.fn(() => Promise.resolve({ ...november, label: 'ciclo de novembro' }));
    const component = await createComponent({ data: { mode: 'edit', cycle: november }, update });
    component.form.setValue({
      label: '  ciclo de novembro  ',
      startDate: '2026-11-02',
      endDate: '2026-12-01',
    });

    await component.submit();

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith('november', {
      label: 'ciclo de novembro',
      startDate: '2026-11-02',
      endDate: '2026-12-01',
    });
  });

  it('shows duplicate_start_date without closing the dialog', async () => {
    const create = vi.fn(() =>
      Promise.reject({
        status: 409,
        code: 'duplicate_start_date',
        message: 'Já existe um ciclo com esta data inicial.',
      }),
    );
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture({ create, dialogRef });
    const component = fixture.componentInstance;
    component.form.setValue({
      label: 'novembro/2026',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });

    await component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Já existe um ciclo com esta data inicial.',
    );
    expect(component.form.getRawValue()).toEqual({
      label: 'novembro/2026',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(dialogRef.disableClose).toBe(false);
  });
});

async function createComponent(
  options: Parameters<typeof createFixture>[0] | CycleFormDialogData = {},
) {
  const normalized = 'mode' in options ? { data: options } : options;
  return (await createFixture(normalized)).componentInstance;
}

async function createFixture(
  options: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    dialogRef?: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
    data?: CycleFormDialogData;
  } = {},
) {
  const dialogRef = options.dialogRef ?? { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [CycleFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: options.data ?? { mode: 'create' } },
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: CycleStore,
        useValue: {
          create: options.create ?? vi.fn(() => Promise.resolve(december)),
          update: options.update ?? vi.fn(() => Promise.resolve(november)),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CycleFormComponent);
  fixture.detectChanges();
  return fixture;
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

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

const november: CycleResponse = {
  id: 'november',
  label: 'novembro/2026',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  isRecurrenceGenerated: false,
  isCurrent: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const december: CycleResponse = {
  ...november,
  id: 'december',
  label: 'dezembro/2026',
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  isCurrent: false,
};
