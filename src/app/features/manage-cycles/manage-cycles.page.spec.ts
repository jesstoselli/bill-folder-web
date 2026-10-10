import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { LoadState } from '../../shared/states/load-state';
import { ManageCyclesPage } from './manage-cycles.page';

describe('ManageCyclesPage', () => {
  it('renders the loading state while cycles are requested', async () => {
    const { fixture } = await createFixture([], { kind: 'loading' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Carregando conteúdo');
  });

  it('renders the initial error with a retry action', async () => {
    const { fixture } = await createFixture([], {
      kind: 'error',
      message: 'Servidor indisponível.',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os ciclos');
    expect(fixture.nativeElement.textContent).toContain('Servidor indisponível.');
    expect(findButton(fixture.nativeElement, 'Tentar novamente')).toBeTruthy();
  });

  it('renders an actionable empty state', async () => {
    const { fixture } = await createFixture([], contentState([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhum ciclo cadastrado');
    expect(fixture.nativeElement.textContent).toContain('Novo ciclo');
  });

  it('shows current and recurrence-generated badges in the cycle ledger', async () => {
    const rows = [october, november];
    const { fixture } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    const currentRow = fixture.nativeElement.querySelector('[data-cycle-id="october"]');
    const generatedRow = fixture.nativeElement.querySelector('[data-cycle-id="november"]');
    expect(currentRow?.textContent).toContain('Atual');
    expect(currentRow?.textContent).toContain('Criado manualmente');
    expect(generatedRow?.textContent).toContain('Gerado automaticamente');
  });

  it('requires confirmation before deleting a cycle', async () => {
    const rows = [october, november];
    const { fixture, cycles, dialog, confirmation } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'october', 'Excluir').click();

    expect(cycles.delete).not.toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledOnce();
    const [dialogComponent, config] = dialog.open.mock.calls[0];
    expect(dialogComponent).toBe(ConfirmActionDialogComponent);
    expect(config.data.message).toContain('pode deixar o app sem um ciclo atual');

    confirmation.next(true);
    confirmation.complete();
    await vi.waitFor(() => expect(cycles.delete).toHaveBeenCalledWith('october'));
  });

  it.each([400, 409])(
    'keeps the list and restores delete focus after a %s failure',
    async (status) => {
      const rows = [october, november];
      const { fixture, cycles, confirmation } = await createFixture(rows, contentState(rows), () =>
        Promise.reject({
          status,
          code: status === 409 ? 'conflict' : 'validation_error',
          message: 'Não foi possível excluir o ciclo.',
        }),
      );
      fixture.detectChanges();
      const deleteButton = findRowButton(fixture.nativeElement, 'october', 'Excluir');
      deleteButton.click();
      confirmation.next(true);
      confirmation.complete();

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(cycles.cycles()).toEqual(rows);
        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
          'Não foi possível excluir o ciclo.',
        );
        expect(document.activeElement).toBe(deleteButton);
      });
    },
  );
});

async function createFixture(
  rows: CycleResponse[],
  initialState: LoadState<CycleResponse[]>,
  deleteImplementation: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const rowSignal = signal(rows);
  const state = signal(initialState);
  const confirmation = new Subject<boolean | undefined>();
  const dialog = {
    open: vi.fn((_component: unknown, _config: { data: { message: string } }) => ({
      afterClosed: () => confirmation.asObservable(),
    })),
  };
  const cycles = {
    state: state.asReadonly(),
    cycles: rowSignal.asReadonly(),
    current: signal(rows.find((cycle) => cycle.isCurrent) ?? null).asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn((id: string) => deleteImplementation(id)),
  };
  TestBed.configureTestingModule({
    imports: [ManageCyclesPage],
    providers: [
      { provide: CycleStore, useValue: cycles },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  return {
    fixture: TestBed.createComponent(ManageCyclesPage),
    cycles,
    dialog,
    confirmation,
  };
}

function contentState(rows: CycleResponse[]): LoadState<CycleResponse[]> {
  return { kind: 'content', data: rows, refreshing: false };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-cycle-id="${id}"]`);
  if (!row) throw new Error(`Row not found: ${id}`);
  return findButton(row, label);
}

const october: CycleResponse = {
  id: 'october',
  label: 'outubro/2026',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  isRecurrenceGenerated: false,
  isCurrent: true,
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
};

const november: CycleResponse = {
  ...october,
  id: 'november',
  label: 'novembro/2026',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  isRecurrenceGenerated: true,
  isCurrent: false,
};
