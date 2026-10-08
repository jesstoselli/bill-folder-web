import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardsStore } from '../../cards.store';
import { RepriceSubscriptionDialogComponent } from './reprice-subscription-dialog.component';

describe('RepriceSubscriptionDialogComponent', () => {
  it('blocks duplicate submits and preserves the resolved recurrence scope', async () => {
    const pending = deferred<unknown>();
    const repriceSubscription = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(repriceSubscription, dialogRef);
    const component = fixture.componentInstance;
    component.form.setValue({ amount: 49.9 });

    const first = component.submit();
    const duplicate = component.submit();
    fixture.detectChanges();

    expect(repriceSubscription).toHaveBeenCalledTimes(1);
    expect(repriceSubscription).toHaveBeenCalledWith('entry-1', 49.9, 'thisAndFollowing');
    expect(dialogRef.disableClose).toBe(true);
    expect(findButton(fixture.nativeElement, 'Fechar').disabled).toBe(true);
    expect(findButton(fixture.nativeElement, 'Cancelar').disabled).toBe(true);

    pending.resolve({ id: 'entry-1', totalAmount: 49.9 });
    await Promise.all([first, duplicate]);
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('keeps the entered amount and releases dismissal after a failed write', async () => {
    const pending = deferred<unknown>();
    const repriceSubscription = vi.fn(() => pending.promise);
    const dialogRef = { close: vi.fn(), disableClose: false };
    const fixture = await createFixture(repriceSubscription, dialogRef);
    const component = fixture.componentInstance;
    component.form.setValue({ amount: 52.75 });

    const submitting = component.submit();
    pending.reject({ status: 400, code: 'validation_error', message: 'Valor inválido.' });
    await submitting;
    fixture.detectChanges();

    expect(component.form.controls.amount.value).toBe(52.75);
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Valor inválido.',
    );
  });
});

async function createFixture(
  repriceSubscription: ReturnType<typeof vi.fn>,
  dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean },
) {
  await TestBed.configureTestingModule({
    imports: [RepriceSubscriptionDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          entry: { id: 'entry-1', label: 'Streaming', totalAmount: 39.9 },
          scope: 'thisAndFollowing',
        },
      },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: CardsStore, useValue: { repriceSubscription } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(RepriceSubscriptionDialogComponent);
  fixture.detectChanges();
  return fixture;
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
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
