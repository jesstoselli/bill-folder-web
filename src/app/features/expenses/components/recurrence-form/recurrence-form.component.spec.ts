import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { ExpensesStore } from '../../expenses.store';
import { RecurrenceFormComponent } from './recurrence-form.component';
import { toCreateExpenseRecurrenceRequest } from './recurrence-form.models';

describe('recurrence form mapping', () => {
  const base = {
    defaultLabel: '  Terapia  ',
    defaultAmount: 150,
    defaultCategoryId: 'category-1',
    startDate: '2026-10-01',
    endDate: '',
  };

  it('serializes only weekday for weekly recurrence', () => {
    expect(
      toCreateExpenseRecurrenceRequest({
        ...base,
        frequency: 'weekly',
        weekday: 3,
        dueDay: 15,
      }),
    ).toEqual({
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      frequency: 'weekly',
      weekday: 3,
      startDate: '2026-10-01',
      endDate: null,
    });
  });

  it('serializes only dueDay for monthly recurrence', () => {
    expect(
      toCreateExpenseRecurrenceRequest({
        ...base,
        frequency: 'monthly',
        weekday: 3,
        dueDay: 15,
      }),
    ).toEqual({
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      frequency: 'monthly',
      dueDay: 15,
      startDate: '2026-10-01',
      endDate: null,
    });
  });
});

describe('RecurrenceFormComponent', () => {
  it('shows only the cadence-specific input', async () => {
    const fixture = await createFixture(vi.fn());

    expect(fixture.nativeElement.querySelector('[data-field="weekday"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-field="due-day"]')).toBeNull();

    fixture.componentInstance.form.controls.frequency.setValue('monthly');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-field="weekday"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-field="due-day"]')).not.toBeNull();
  });

  it('validates only the cadence-specific day field', async () => {
    const fixture = await createFixture(vi.fn());
    const form = fixture.componentInstance.form;
    form.setValue({
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      frequency: 'monthly',
      dueDay: 0,
      weekday: 3,
      startDate: '2026-10-01',
      endDate: '',
    });
    expect(form.invalid).toBe(true);

    form.controls.frequency.setValue('weekly');

    expect(form.valid).toBe(true);
  });

  it('keeps recurrence values and the server error visible after failure', async () => {
    const createRecurrence = vi.fn(() =>
      Promise.reject({
        status: 400,
        code: 'invalid_category',
        message: 'Categoria inválida.',
      }),
    );
    const fixture = await createFixture(createRecurrence);
    const component = fixture.componentInstance;
    component.form.setValue({
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      frequency: 'weekly',
      dueDay: 10,
      weekday: 3,
      startDate: '2026-10-01',
      endDate: '',
    });

    await component.submit();
    fixture.detectChanges();

    expect(component.form.getRawValue()).toMatchObject({
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      weekday: 3,
    });
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Categoria inválida.',
    );
  });
});

async function createFixture(createRecurrence: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [RecurrenceFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: {} },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: ReferenceDataApi, useValue: { categories: () => of([]) } },
      { provide: ExpensesStore, useValue: { createRecurrence } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(RecurrenceFormComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}
