import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CreditCardAccountResponse } from '../../../cards/cards.models';
import { ManageCardsStore } from '../../manage-cards.store';
import { CreditCardFormComponent, CreditCardFormDialogData } from './credit-card-form.component';

describe('CreditCardFormComponent', () => {
  it('creates a card sending blank optional fields as null', async () => {
    const { component, store, dialogRef } = await setup({ mode: 'create' });
    component.form.setValue({
      name: '  Itaú Personnalité ',
      issuerBank: '  ',
      brand: 'Visa',
      closingDay: 5,
      dueDay: 12,
    });

    await component.submit();

    expect(store.create).toHaveBeenCalledWith({
      name: 'Itaú Personnalité',
      issuerBank: null,
      brand: 'Visa',
      closingDay: 5,
      dueDay: 12,
    });
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('clears the issuer on edit by sending an empty string', async () => {
    const { component, store } = await setup({ mode: 'edit', card });
    component.form.controls.issuerBank.setValue('');

    await component.submit();

    expect(store.update).toHaveBeenCalledWith('card-1', {
      name: 'Itaú Personnalité',
      issuerBank: '',
      brand: 'Visa',
      closingDay: 5,
      dueDay: 12,
    });
  });

  it.each([0, 32, 4.5, null])('rejects %s as a closing day', async (day) => {
    const { component, store } = await setup({ mode: 'create' });
    component.form.setValue({
      name: 'Cartão',
      issuerBank: '',
      brand: '',
      closingDay: day,
      dueDay: 10,
    });

    await component.submit();

    expect(component.form.controls.closingDay.invalid).toBe(true);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('requires a name', async () => {
    const { component, store } = await setup({ mode: 'create' });
    component.form.setValue({ name: '   ', issuerBank: '', brand: '', closingDay: 1, dueDay: 10 });

    await component.submit();

    expect(store.create).not.toHaveBeenCalled();
  });

  it('only shows the closing/due day hint when editing', async () => {
    const created = await setup({ mode: 'create' });
    expect(created.element.textContent).not.toContain('lançamentos futuros');
    TestBed.resetTestingModule();
    const edited = await setup({ mode: 'edit', card });
    expect(edited.element.textContent).toContain('lançamentos futuros');
  });
});

async function setup(data: CreditCardFormDialogData) {
  const store = {
    create: vi.fn(() => Promise.resolve(card)),
    update: vi.fn(() => Promise.resolve(card)),
  };
  const dialogRef = { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [CreditCardFormComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: ManageCardsStore, useValue: store },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CreditCardFormComponent);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
    store,
    dialogRef,
  };
}

const card: CreditCardAccountResponse = {
  id: 'card-1',
  name: 'Itaú Personnalité',
  issuerBank: 'Itaú',
  brand: 'Visa',
  closingDay: 5,
  dueDay: 12,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};
