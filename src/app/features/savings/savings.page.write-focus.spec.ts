import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { SavingsTransactionResponse } from './savings.models';
import { SavingsPage } from './savings.page';
import { SavingsTransactionFormComponent } from './components/savings-transaction-form/savings-transaction-form.component';

describe('SavingsPage write focus across the shared data refresh', () => {
  let backend: HttpTestingController;
  let dialog: MatDialog;
  let fixture: ComponentFixture<SavingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
        {
          provide: CycleStore,
          useValue: {
            state: signal({
              kind: 'content' as const,
              data: [october],
              refreshing: false,
            }).asReadonly(),
            current: signal<CycleResponse | null>(october).asReadonly(),
            previous: signal(null).asReadonly(),
            next: signal(null).asReadonly(),
            load: vi.fn(),
            selectPrevious: vi.fn(),
            selectNext: vi.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    dialog = TestBed.inject(MatDialog);
    fixture = TestBed.createComponent(SavingsPage);
  });

  afterEach(() => {
    dialog.closeAll();
    TestBed.inject(OverlayContainer).getContainerElement().replaceChildren();
    backend.verify();
  });

  it('focuses the stable create action after an edit refresh replaces the row', async () => {
    await loadPage();
    findRowButton(fixture.nativeElement, 'transaction-1', 'Editar').click();
    fixture.detectChanges();
    await settle();
    const editor = openDialog();
    editor.form.patchValue({ amount: 125, label: 'Reserva revista' });

    const submission = editor.submit();
    const update = backend.expectOne('/v1/savings-transactions/transaction-1');
    expect(update.request.method).toBe('PATCH');
    update.flush(transaction({ amount: 125, label: 'Reserva revista' }));

    await refreshAfterWrite([transaction({ amount: 125, label: 'Reserva revista' })]);
    await submission;
    await waitForDialogClosed();

    expect(document.activeElement).toBe(findButton(fixture.nativeElement, 'Novo movimento'));
  });

  it('keeps delete completion focus stable after the version refresh', async () => {
    await loadPage();
    findRowButton(fixture.nativeElement, 'transaction-1', 'Excluir').click();
    const deletion = backend.expectOne('/v1/savings-transactions/transaction-1');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);

    await refreshAfterWrite([]);

    expect(document.activeElement).toBe(findButton(fixture.nativeElement, 'Novo movimento'));
  });

  async function loadPage(): Promise<void> {
    fixture.detectChanges();
    backend.expectOne('/v1/savings-accounts/').flush([account]);
    await nextMicrotask();
    backend.expectOne(transactionUrl).flush([transaction()]);
    await settle();
  }

  async function refreshAfterWrite(
    transactions: readonly SavingsTransactionResponse[],
  ): Promise<void> {
    TestBed.tick();
    await nextMicrotask();
    backend.expectOne('/v1/savings-accounts/').flush([account]);
    await nextMicrotask();
    backend.expectOne(transactionUrl).flush(transactions);
    await settle();
  }

  function openDialog(): SavingsTransactionFormComponent {
    const instance = dialog.openDialogs
      .map((reference) => reference.componentInstance)
      .find((candidate) => candidate instanceof SavingsTransactionFormComponent);
    expect(instance).toBeInstanceOf(SavingsTransactionFormComponent);
    return instance as SavingsTransactionFormComponent;
  }

  async function waitForDialogClosed(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        dialog.openDialogs.some(
          (reference) => reference.componentInstance instanceof SavingsTransactionFormComponent,
        ),
      ).toBe(false);
    });
  }

  async function settle(): Promise<void> {
    await nextMicrotask();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-transaction-id="${id}"]`);
  if (!row) throw new Error(`Row not found: ${id}`);
  return findButton(row, label);
}

async function nextMicrotask(): Promise<void> {
  await Promise.resolve();
}

function transaction(
  overrides: Partial<SavingsTransactionResponse> = {},
): SavingsTransactionResponse {
  return {
    id: 'transaction-1',
    savingsAccountId: 'savings-1',
    type: 'deposit',
    amount: 100,
    date: '2026-10-12',
    label: 'Reserva mensal',
    linkedTransactionId: null,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:00:00Z',
    ...overrides,
  };
}

const account = {
  id: 'savings-1',
  checkingAccountId: 'checking-1',
  bankName: 'Banco Reserva',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 500,
  currentBalance: 900,
  createdAt: '',
  updatedAt: '',
};

const october: CycleResponse = {
  id: 'cycle-october',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '',
  updatedAt: '',
};

const transactionUrl =
  '/v1/savings-transactions/?savingsAccountId=savings-1&from=2026-10-01&to=2026-10-31';
