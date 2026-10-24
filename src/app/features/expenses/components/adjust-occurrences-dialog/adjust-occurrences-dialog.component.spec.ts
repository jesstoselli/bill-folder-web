import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ExpensesStore } from '../../expenses.store';
import { AdjustOccurrencesDialogComponent } from './adjust-occurrences-dialog.component';

async function setup(paid = 0, total = 5) {
  const updateOccurrences = vi.fn(() => Promise.resolve({ id: 'therapy' }));
  const dialogRef = { close: vi.fn(), disableClose: false };
  await TestBed.configureTestingModule({
    imports: [AdjustOccurrencesDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          expense: {
            id: 'therapy',
            label: 'Terapia',
            occurrenceAmount: 200,
            occurrencesTotal: total,
            occurrencesPaid: paid,
          },
        },
      },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: ExpensesStore, useValue: { updateOccurrences } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AdjustOccurrencesDialogComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
    )!;
  const click = (label: string) => {
    button(label).click();
    fixture.detectChanges();
  };
  return { fixture, root, button, click, updateOccurrences, dialogRef };
}

describe('AdjustOccurrencesDialogComponent', () => {
  it('recalculates the total as sessions change and saves only this cycle', async () => {
    const { fixture, root, button, click, updateOccurrences, dialogRef } = await setup();

    expect(root.textContent).toContain('5 sessões');
    expect(button('Salvar sessões').disabled).toBe(true);

    click('Uma sessão a menos');
    click('Uma sessão a menos');

    expect(root.querySelector('output')?.textContent).toContain('3 sessões');
    expect(root.textContent).toMatch(/R\$\s*600,00/);
    expect(root.textContent).toMatch(/antes:\s*R\$\s*1\.000,00/);
    expect(button('Salvar sessões').disabled).toBe(false);

    await fixture.componentInstance.submit();

    expect(updateOccurrences).toHaveBeenCalledWith('therapy', 3);
    expect(dialogRef.close).toHaveBeenCalledWith({ id: 'therapy' });
  });

  it('stops at the sessions already paid', async () => {
    const { root, button, click } = await setup(2, 3);

    click('Uma sessão a menos');
    click('Uma sessão a menos');

    expect(root.querySelector('output')?.textContent).toContain('2 sessões');
    expect(button('Uma sessão a menos').disabled).toBe(true);
    expect(root.textContent).toContain('2 sessões já pagas');
  });

  it('never goes below one session or above ten', async () => {
    const low = await setup(0, 1);
    expect(low.button('Uma sessão a menos').disabled).toBe(true);
    expect(low.root.querySelector('output')?.textContent).toContain('1 sessão');
    TestBed.resetTestingModule();

    const high = await setup(0, 10);
    expect(high.button('Uma sessão a mais').disabled).toBe(true);
  });
});
