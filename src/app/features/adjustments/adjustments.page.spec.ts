import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { CycleAdjustmentResponse } from './adjustments.models';
import { AdjustmentsPage } from './adjustments.page';
import { AdjustmentsStore } from './adjustments.store';

describe('AdjustmentsPage', () => {
  it('renders a textual negative sign and plain Portuguese movement types', async () => {
    const rows = [
      adjustment({ id: 'out', type: 'outflow', amount: 80 }),
      adjustment({ id: 'in', type: 'inflow', amount: 30 }),
    ];
    const { fixture } = await createFixture(rows, -50);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const net = root.querySelector('.adjustments-summary__net');
    expect(net?.textContent).toMatch(/Negativo:\s*−\s*R\$\s*50,00/);
    expect(net?.classList).toContain('adjustments-summary__net--negative');
    expect(root.querySelector('[data-adjustment-id="out"]')?.textContent).toContain('Saída');
    expect(root.querySelector('[data-adjustment-id="in"]')?.textContent).toContain('Entrada');
  });

  it('restores the deleted row focus after an optimistic delete fails', async () => {
    const rows = [adjustment({ id: 'first' }), adjustment({ id: 'second' })];
    let rejectDelete: (reason: unknown) => void = () => undefined;
    const { fixture, adjustments } = await createFixture(rows, -80, (id) => {
      adjustments.set(adjustments().filter((row) => row.id !== id));
      return new Promise<void>((_, reject) => {
        rejectDelete = (reason) => {
          adjustments.set(rows);
          reject(reason);
        };
      });
    });
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'first', 'Excluir').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-adjustment-id="first"]')).toBeNull();

    rejectDelete({ status: 409, code: 'conflict', message: 'Exclusão recusada.' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      const restored = findRowButton(fixture.nativeElement, 'first', 'Excluir');
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Exclusão recusada.',
      );
      expect(document.activeElement).toBe(restored);
    });
  });

  it('does not steal focus in cycle B when a cycle-A delete completes', async () => {
    let resolveDelete: () => void = () => undefined;
    const { fixture, adjustments, current } = await createFixture(
      [adjustment({ id: 'october' })],
      -40,
      (id) => {
        adjustments.set(adjustments().filter((row) => row.id !== id));
        return new Promise<void>((resolve) => (resolveDelete = resolve));
      },
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'october', 'Excluir').click();
    current.set(novemberCycle);
    adjustments.set([adjustment({ id: 'november', date: '2026-11-03' })]);
    fixture.detectChanges();
    const refresh = findButton(fixture.nativeElement, 'Atualizar');
    refresh.focus();

    resolveDelete();
    await Promise.resolve();
    fixture.detectChanges();
    expect(document.activeElement).toBe(refresh);
  });

  it('does not publish a cycle-A delete failure or steal focus after cycle B is selected', async () => {
    const pendingDelete = deferred<void>();
    const { fixture, adjustments, current } = await createFixture(
      [adjustment({ id: 'october' })],
      -40,
      (id) => {
        adjustments.set(adjustments().filter((row) => row.id !== id));
        return pendingDelete.promise;
      },
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'october', 'Excluir').click();

    current.set(novemberCycle);
    adjustments.set([adjustment({ id: 'november', date: '2026-11-03' })]);
    fixture.detectChanges();
    const refresh = findButton(fixture.nativeElement, 'Atualizar');
    refresh.focus();

    pendingDelete.reject({
      status: 409,
      code: 'conflict',
      message: 'Exclusão de outubro recusada.',
    });
    await expect(pendingDelete.promise).rejects.toMatchObject({ status: 409 });
    await Promise.resolve();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.adjustments-page__error')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-adjustment-id="november"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-adjustment-id="october"]')).toBeNull();
      expect(document.activeElement).toBe(refresh);
    });
  });

  it('moves focus to Novo ajuste after successfully deleting the only row', async () => {
    const { fixture, adjustments } = await createFixture(
      [adjustment({ id: 'only' })],
      -40,
      (id) => {
        adjustments.set(adjustments().filter((row) => row.id !== id));
        return Promise.resolve();
      },
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'only', 'Excluir').click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const create = findButton(fixture.nativeElement, 'Novo ajuste');
      expect(fixture.nativeElement.textContent).toContain('Nenhum ajuste neste ciclo');
      expect(document.activeElement).toBe(create);
    });
  });
});

async function createFixture(
  rows: CycleAdjustmentResponse[],
  netAmount: number,
  deleteImplementation: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const adjustments = signal(rows);
  const current = signal<CycleResponse | null>(cycle);
  await TestBed.configureTestingModule({
    imports: [AdjustmentsPage],
    providers: [
      {
        provide: AdjustmentsStore,
        useValue: {
          state: signal({ kind: 'content' as const, data: rows, refreshing: false }).asReadonly(),
          adjustments: adjustments.asReadonly(),
          netAmount: signal(netAmount).asReadonly(),
          refresh: vi.fn(() => Promise.resolve()),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn((id: string) => deleteImplementation(id)),
        },
      },
      {
        provide: CycleStore,
        useValue: {
          state: signal({
            kind: 'content' as const,
            data: [cycle],
            refreshing: false,
          }).asReadonly(),
          current: current.asReadonly(),
          previous: signal(null).asReadonly(),
          next: signal(null).asReadonly(),
          load: vi.fn(),
          selectPrevious: vi.fn(),
          selectNext: vi.fn(),
        },
      },
    ],
  }).compileComponents();
  return { fixture: TestBed.createComponent(AdjustmentsPage), adjustments, current };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-adjustment-id="${id}"]`);
  if (!row) throw new Error(`Row not found: ${id}`);
  return findButton(row, label);
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
function adjustment(overrides: Partial<CycleAdjustmentResponse> = {}): CycleAdjustmentResponse {
  return {
    id: 'adjustment-1',
    type: 'outflow',
    label: 'Acerto',
    amount: 40,
    date: '2026-10-12',
    sourceSavingsTransactionId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
const cycle: CycleResponse = {
  id: 'cycle-october',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '',
  updatedAt: '',
};
const novemberCycle: CycleResponse = {
  ...cycle,
  id: 'cycle-november',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
  isCurrent: false,
};
