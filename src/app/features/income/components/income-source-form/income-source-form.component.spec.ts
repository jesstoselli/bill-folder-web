import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { IncomeSourcesStore } from '../../income-sources.store';
import { IncomeSourceResponse } from '../../income.models';
import {
  IncomeSourceFormComponent,
  IncomeSourceFormDialogData,
} from './income-source-form.component';

describe('IncomeSourceFormComponent', () => {
  it('creates a source without an end date as null', async () => {
    const { component, store } = await setup({ mode: 'create' });
    component.form.patchValue({
      origin: '  Salário CLT ',
      originType: 'work',
      defaultAmount: 5000,
      expectedDay: 5,
      startDate: '2026-10-01',
      endDate: '',
    });

    await component.submit();

    expect(store.create).toHaveBeenCalledWith({
      origin: 'Salário CLT',
      originType: 'work',
      defaultAmount: 5000,
      expectedDay: 5,
      startDate: '2026-10-01',
      endDate: null,
    });
  });

  it('asks the API to remove an end date the user cleared', async () => {
    const { component, store } = await setup({
      mode: 'edit',
      source: { ...source, endDate: '2026-12-31' },
    });
    component.form.controls.endDate.setValue('');

    await component.submit();

    expect(store.update).toHaveBeenCalledWith(
      'source-1',
      expect.objectContaining({ clearEndDate: true }),
    );
    expect(store.update.mock.calls[0][1]).not.toHaveProperty('endDate');
  });

  it('sends a new end date as is', async () => {
    const { component, store } = await setup({ mode: 'edit', source });
    component.form.controls.endDate.setValue('2027-03-31');

    await component.submit();

    expect(store.update.mock.calls[0][1]).toMatchObject({ endDate: '2027-03-31' });
    expect(store.update.mock.calls[0][1]).not.toHaveProperty('clearEndDate');
  });

  it('sends neither field when there was and is no end date', async () => {
    const { component, store } = await setup({ mode: 'edit', source });

    await component.submit();

    expect(store.update.mock.calls[0][1]).not.toHaveProperty('endDate');
    expect(store.update.mock.calls[0][1]).not.toHaveProperty('clearEndDate');
  });

  it('accepts an end on the start day and rejects one before it', async () => {
    const { component } = await setup({ mode: 'edit', source });
    component.form.controls.endDate.setValue('2026-10-01');
    expect(component.form.hasError('dateRange')).toBe(false);

    component.form.controls.endDate.setValue('2026-09-30');
    expect(component.form.hasError('dateRange')).toBe(true);
  });

  it.each([
    ['defaultAmount', 0],
    ['expectedDay', 32],
    ['origin', '  '],
  ] as const)('rejects an invalid %s', async (field, value) => {
    const { component, store } = await setup({ mode: 'edit', source });
    component.form.controls[field].setValue(value as never);

    await component.submit();

    expect(store.update).not.toHaveBeenCalled();
  });
});

async function setup(data: IncomeSourceFormDialogData) {
  const store = {
    create: vi.fn(() => Promise.resolve(source)),
    update: vi.fn((_id: string, _request: object) => Promise.resolve(source)),
  };
  await TestBed.configureTestingModule({
    imports: [IncomeSourceFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
      { provide: IncomeSourcesStore, useValue: store },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(IncomeSourceFormComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance, store };
}

const source: IncomeSourceResponse = {
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
