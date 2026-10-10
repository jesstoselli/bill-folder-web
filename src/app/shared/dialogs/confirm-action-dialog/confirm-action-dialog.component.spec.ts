import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmActionDialogComponent } from './confirm-action-dialog.component';

describe('ConfirmActionDialogComponent', () => {
  it('renders the confirmation copy and closes with the selected boolean result', async () => {
    const close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ConfirmActionDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Excluir conta?',
            message: 'Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmActionDialogComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h2')?.textContent).toContain('Excluir conta?');
    expect(root.querySelector('mat-dialog-content')?.textContent).toContain(
      'Esta ação não pode ser desfeita.',
    );

    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
    buttons.find((button) => button.textContent?.includes('Excluir'))!.click();
    expect(close).toHaveBeenCalledWith(true);

    buttons.find((button) => button.textContent?.includes('Cancelar'))!.click();
    expect(close).toHaveBeenCalledWith(false);
  });
});
