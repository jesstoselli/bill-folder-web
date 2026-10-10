import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CheckingAccountsApi } from '../../../../core/checking-accounts/checking-accounts.api';
import { ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { CardEntryResponse } from '../../cards.models';
import { CardsStore } from '../../cards.store';
import { CardEntryFormComponent } from './card-entry-form.component';

describe('CardEntryFormComponent', () => {
  it('submits a one-off purchase with installments and locks duplicate writes', async () => {
    const pending = deferred<unknown>();
    const createEntry = vi.fn(() => pending.promise);
    const createRecurrence = vi.fn();
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(
      { mode: 'create', card: { id: 'card-1', name: 'Nubank' } },
      { createEntry, createRecurrence },
      dialogRef,
    );
    const component = fixture.componentInstance;
    component.form.setValue({
      cardId: 'card-1',
      purchaseDate: '2026-10-08',
      label: 'Notebook',
      totalAmount: 1200,
      installmentsCount: 3,
      categoryId: 'category-1',
      notes: '',
      repeatMonthly: false,
    });

    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();

    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(createEntry).toHaveBeenCalledWith({
      cardId: 'card-1',
      purchaseDate: '2026-10-08',
      label: 'Notebook',
      totalAmount: 1200,
      installmentsCount: 3,
      categoryId: 'category-1',
      notes: null,
    });
    expect(createRecurrence).not.toHaveBeenCalled();
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Fechar').disabled).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    pending.resolve({ id: 'entry-1' });
    await Promise.all([first, duplicate]);
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('hides installments and creates only a monthly recurrence template', async () => {
    const createEntry = vi.fn();
    const createRecurrence = vi.fn(() => Promise.resolve({ id: 'template-1' }));
    const fixture = await createFixture(
      { mode: 'create', card: { id: 'card-1', name: 'Nubank' } },
      { createEntry, createRecurrence },
    );
    const component = fixture.componentInstance;
    component.form.setValue({
      cardId: 'card-1',
      purchaseDate: '2026-10-08',
      label: 'Streaming',
      totalAmount: 39.9,
      installmentsCount: 12,
      categoryId: 'category-1',
      notes: '',
      repeatMonthly: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-field="installments"]')).toBeNull();
    // The recurrence API has no notes field, so the form must not offer one.
    expect(fixture.nativeElement.querySelector('[data-field="notes"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('nem guarda observações');
    await component.submit();

    expect(createEntry).not.toHaveBeenCalled();
    expect(createRecurrence).toHaveBeenCalledWith({
      cardId: 'card-1',
      defaultLabel: 'Streaming',
      defaultAmount: 39.9,
      defaultCategoryId: 'category-1',
      dayOfMonth: 8,
      startDate: '2026-10-08',
      endDate: null,
    });
  });

  it('accepts 36 installments at the one-off purchase upper boundary', async () => {
    const createEntry = vi.fn(() => Promise.resolve({ id: 'entry-1' }));
    const fixture = await createFixture(
      { mode: 'create', card: { id: 'card-1', name: 'Nubank' } },
      { createEntry, createRecurrence: vi.fn() },
    );
    fixture.componentInstance.form.setValue({
      cardId: 'card-1',
      purchaseDate: '2026-10-08',
      label: 'Notebook',
      totalAmount: 1200,
      installmentsCount: 36,
      categoryId: 'category-1',
      notes: '',
      repeatMonthly: false,
    });

    await fixture.componentInstance.submit();

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ installmentsCount: 36 }));
  });

  it('rejects 37 installments without writing and exposes the client-side limit', async () => {
    const createEntry = vi.fn();
    const fixture = await createFixture(
      { mode: 'create', card: { id: 'card-1', name: 'Nubank' } },
      { createEntry, createRecurrence: vi.fn() },
    );
    fixture.componentInstance.form.setValue({
      cardId: 'card-1',
      purchaseDate: '2026-10-08',
      label: 'Notebook',
      totalAmount: 1200,
      installmentsCount: 37,
      categoryId: 'category-1',
      notes: '',
      repeatMonthly: false,
    });

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-field="installments"] input',
    );
    expect(input?.getAttribute('max')).toBe('36');
    expect(fixture.nativeElement.textContent).toContain(
      'Informe uma quantidade inteira entre 1 e 36.',
    );
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('edits only mutable backend fields and keeps immutable fields disabled', async () => {
    const updateEntry = vi.fn(() => Promise.resolve({ id: 'entry-1' }));
    const fixture = await createFixture({ mode: 'edit', entry: entry() }, { updateEntry });
    const component = fixture.componentInstance;
    component.form.patchValue({ label: 'Notebook de trabalho', notes: 'Patrimônio' });
    fixture.detectChanges();

    expect(component.form.controls.purchaseDate.disabled).toBe(true);
    expect(component.form.controls.totalAmount.disabled).toBe(true);
    expect(component.form.controls.installmentsCount.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-field="repeat-monthly"]')).toBeNull();

    await component.submit();

    expect(updateEntry).toHaveBeenCalledWith('entry-1', {
      label: 'Notebook de trabalho',
      categoryId: 'category-1',
      notes: 'Patrimônio',
    });
  });

  it('sends an empty string when an existing note is cleared', async () => {
    const updateEntry = vi.fn(() => Promise.resolve({ id: 'entry-1' }));
    const fixture = await createFixture(
      { mode: 'edit', entry: entry({ notes: 'Patrimônio' }) },
      { updateEntry },
    );

    fixture.componentInstance.form.patchValue({ notes: '   ' });
    await fixture.componentInstance.submit();

    expect(updateEntry).toHaveBeenCalledWith('entry-1', {
      label: 'Notebook',
      categoryId: 'category-1',
      notes: '',
    });
  });
});

async function createFixture(
  data:
    | { mode: 'create'; card: { id: string; name: string } }
    | { mode: 'edit'; entry: CardEntryResponse },
  store: Record<string, unknown>,
  dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean } = {
    close: vi.fn(),
    disableClose: false,
  },
) {
  await TestBed.configureTestingModule({
    imports: [CardEntryFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: CardsStore, useValue: store },
      {
        provide: ReferenceDataApi,
        useValue: {
          categories: () =>
            of([
              {
                id: 'category-1',
                key: 'shopping',
                namePt: 'Compras',
                isSystem: true,
                displayOrder: 1,
              },
            ]),
        },
      },
      { provide: CheckingAccountsApi, useValue: { list: () => of([]) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CardEntryFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function entry(overrides: Partial<CardEntryResponse> = {}): CardEntryResponse {
  return {
    id: 'entry-1',
    cardId: 'card-1',
    cardName: 'Nubank',
    purchaseDate: '2026-09-15',
    label: 'Notebook',
    totalAmount: 1200,
    installmentsCount: 3,
    categoryId: 'category-1',
    categoryName: 'Compras',
    notes: null,
    createdAt: '',
    updatedAt: '',
    templateId: null,
    installments: [],
    ...overrides,
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
