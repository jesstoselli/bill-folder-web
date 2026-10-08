import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { ExpenseFormComponent } from './expense-form.component';
import { toCreateExpenseRequest, toUpdateExpenseRequest } from './expense-form.models';
import { ExpensesStore } from '../../expenses.store';

describe('expense form mapping', () => {
  const value = {
    dueDate: '2026-10-18',
    label: '  Energia  ',
    expectedAmount: 189.9,
    categoryId: 'category-1',
    notes: '  Conta revisada  ',
  };

  it('maps the exact create request and normalizes text boundaries', () => {
    expect(toCreateExpenseRequest(value)).toEqual({
      dueDate: '2026-10-18',
      label: 'Energia',
      expectedAmount: 189.9,
      categoryId: 'category-1',
      notes: 'Conta revisada',
    });
  });

  it('maps the editable fields only for a generic update', () => {
    expect(toUpdateExpenseRequest(value)).toEqual({
      dueDate: '2026-10-18',
      label: 'Energia',
      expectedAmount: 189.9,
      categoryId: 'category-1',
      notes: 'Conta revisada',
    });
  });

  it('keeps an empty notes field present so the backend can clear it', () => {
    expect(toUpdateExpenseRequest({ ...value, notes: '   ' }).notes).toBe('');
  });
});

describe('ExpenseFormComponent failed save', () => {
  it('keeps entered values and the server error visible after a failed create', async () => {
    let rejectSave: (reason: unknown) => void = () => undefined;
    const create = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    const close = vi.fn();
    const state = signal({ kind: 'content' as const, data: [], refreshing: false });

    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'create' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: ReferenceDataApi, useValue: { categories: () => of([]) } },
        {
          provide: ExpensesStore,
          useValue: { create, state: state.asReadonly() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.setValue({
      dueDate: '2026-02-31',
      label: '   ',
      expectedAmount: 0,
      categoryId: '',
      notes: '',
    });

    expect(component.form.controls.dueDate.valid).toBe(false);
    expect(component.form.controls.label.valid).toBe(false);
    expect(component.form.controls.expectedAmount.valid).toBe(false);
    expect(component.form.controls.categoryId.valid).toBe(false);

    component.form.setValue({
      dueDate: '2026-10-18',
      label: 'Energia',
      expectedAmount: 189.9,
      categoryId: 'category-1',
      notes: 'Não apagar',
    });

    const submitting = component.submit();
    rejectSave({ status: 400, code: 'validation_error', message: 'Categoria inválida.' });
    await submitting;
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      dueDate: '2026-10-18',
      label: 'Energia',
      expectedAmount: 189.9,
      categoryId: 'category-1',
      notes: 'Não apagar',
    });
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Categoria inválida.',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
