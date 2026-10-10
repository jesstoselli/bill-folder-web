import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { ConfirmActionDialogComponent } from '../../../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { LoadState } from '../../../../shared/states/load-state';
import { IncomeSourcesStore } from '../../income-sources.store';
import { IncomeSourceResponse } from '../../income.models';
import { IncomeSourcesComponent } from './income-sources.component';

describe('IncomeSourcesComponent', () => {
  it('loads the sources and renders type, day, period and amount', async () => {
    const { fixture, store } = await createFixture([salary, rent]);
    fixture.detectChanges();

    expect(store.load).toHaveBeenCalled();
    const rows = [...fixture.nativeElement.querySelectorAll('[data-income-source-id]')];
    const salaryText = rows[0].textContent.replace(/\s+/g, ' ');
    expect(salaryText).toContain('Salário CLT');
    expect(salaryText).toContain('Trabalho');
    expect(salaryText).toContain('Todo dia 5');
    expect(salaryText).toContain('Desde 01/10/2026');
    expect(salaryText).toContain('R$ 5.000,00');
    const rentText = rows[1].textContent.replace(/\s+/g, ' ');
    expect(rentText).toContain('Aluguel · Inativa');
    expect(rentText).toContain('01/01/2026 a 31/12/2026');
  });

  it('confirms before deleting and says past entries stay', async () => {
    const { fixture, store, dialog, confirmation } = await createFixture([salary]);
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'source-1', 'Excluir').click();
    const [component, config] = dialog.open.mock.calls[0] as unknown as [
      unknown,
      { data: { message: string } },
    ];
    expect(component).toBe(ConfirmActionDialogComponent);
    expect(config.data.message).toContain('recebimentos já criados continuam');

    confirmation.next(true);
    confirmation.complete();
    await vi.waitFor(() => expect(store.delete).toHaveBeenCalledWith('source-1'));
  });

  it('offers to create the first source when there is none', async () => {
    const { fixture } = await createFixture([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma fonte recorrente');
  });
});

async function createFixture(rows: IncomeSourceResponse[]) {
  const state = signal<LoadState<readonly IncomeSourceResponse[]>>({
    kind: 'content',
    data: rows,
    refreshing: false,
  });
  const confirmation = new Subject<boolean | undefined>();
  const dialog = { open: vi.fn(() => ({ afterClosed: () => confirmation.asObservable() })) };
  const store = {
    state: state.asReadonly(),
    sources: signal(rows).asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  };
  await TestBed.configureTestingModule({
    imports: [IncomeSourcesComponent],
    providers: [
      { provide: IncomeSourcesStore, useValue: store },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  return { fixture: TestBed.createComponent(IncomeSourcesComponent), store, dialog, confirmation };
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-income-source-id="${id}"]`);
  const button = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

const salary: IncomeSourceResponse = {
  id: 'source-1',
  origin: 'Salário CLT',
  originType: 'work',
  defaultAmount: 5000,
  expectedDay: 5,
  startDate: '2026-10-01',
  endDate: null,
  isActive: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const rent: IncomeSourceResponse = {
  ...salary,
  id: 'source-2',
  origin: 'Aluguel do apto',
  originType: 'rent',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  isActive: false,
};
