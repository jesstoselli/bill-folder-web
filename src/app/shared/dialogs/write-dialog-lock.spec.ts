import { describe, expect, it, vi } from 'vitest';
import { WriteDialogLock } from './write-dialog-lock';

describe('WriteDialogLock', () => {
  it('touches an invalid form and does not write', async () => {
    const { lock, dialogRef } = setup();
    const form = { invalid: true, markAllAsTouched: vi.fn() };
    const write = vi.fn();

    await lock.run(form, write);

    expect(form.markAllAsTouched).toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(dialogRef.disableClose).toBe(false);
  });

  it('locks the dialog while writing and closes it with the result', async () => {
    const { lock, dialogRef } = setup();
    let resolve: (value: string) => void = () => undefined;
    const pending = lock.run(validForm(), () => new Promise<string>((done) => (resolve = done)));

    expect(lock.saving()).toBe(true);
    expect(dialogRef.disableClose).toBe(true);
    resolve('saved');
    await pending;

    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('ignores a second submit while the first is pending', async () => {
    const { lock } = setup();
    let resolve: () => void = () => undefined;
    const write = vi.fn(() => new Promise<void>((done) => (resolve = done)));

    const first = lock.run(validForm(), write);
    await lock.run(validForm(), write);
    resolve();
    await first;

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('shows the API error and unlocks so the user can retry', async () => {
    const { lock, dialogRef } = setup();
    lock.error.set('stale message');

    await lock.run(validForm(), () =>
      Promise.reject({ status: 409, code: 'conflict', message: 'Conflito.' }),
    );

    expect(lock.error()).toBe('Conflito.');
    expect(lock.saving()).toBe(false);
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('clears the previous error when a new write starts', async () => {
    const { lock } = setup();
    lock.error.set('stale message');

    await lock.run(validForm(), () => Promise.resolve(null));

    expect(lock.error()).toBe('');
  });
});

function setup() {
  const dialogRef = { disableClose: false as boolean | undefined, close: vi.fn() };
  return { lock: new WriteDialogLock(dialogRef), dialogRef };
}

function validForm() {
  return { invalid: false, markAllAsTouched: vi.fn() };
}
