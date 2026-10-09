import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  function setup(isEnabled = true) {
    const versionUpdates = new Subject<VersionEvent>();
    const unrecoverable = new Subject<unknown>();
    const action = new Subject<void>();
    const updates = {
      isEnabled,
      versionUpdates,
      unrecoverable,
      activateUpdate: vi.fn(() => Promise.resolve(true)),
      checkForUpdate: vi.fn(() => Promise.resolve(false)),
    };
    const snackBar = { open: vi.fn(() => ({ onAction: () => action })) };
    const reload = vi.fn();
    const fakeDocument = Object.assign(new EventTarget(), {
      visibilityState: 'visible',
      defaultView: { location: { reload } },
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: updates },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    TestBed.inject(AppUpdateService).start();
    return { versionUpdates, unrecoverable, action, updates, snackBar, reload, fakeDocument };
  }

  const ready = {
    type: 'VERSION_READY',
    currentVersion: { hash: 'old' },
    latestVersion: { hash: 'new' },
  } as VersionEvent;

  it('offers a reload once when a new version is ready and activates it on action', async () => {
    const { versionUpdates, action, updates, snackBar, reload } = setup();

    versionUpdates.next(ready);
    versionUpdates.next(ready);

    await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalled());
    expect(snackBar.open).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();

    action.next();
    await Promise.resolve();
    await Promise.resolve();

    expect(updates.activateUpdate).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('ignores version events other than VERSION_READY', async () => {
    const { versionUpdates, snackBar } = setup();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } } as VersionEvent);
    await import('@angular/material/snack-bar');

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('reloads when the service worker state is unrecoverable', () => {
    const { unrecoverable, reload } = setup();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    expect(reload).toHaveBeenCalledOnce();
  });

  it('checks for an update when the tab becomes visible', () => {
    const { updates, fakeDocument } = setup();

    fakeDocument.dispatchEvent(new Event('visibilitychange'));

    expect(updates.checkForUpdate).toHaveBeenCalledOnce();
  });

  it('does nothing when the service worker is disabled', () => {
    const { versionUpdates, snackBar } = setup(false);

    versionUpdates.next(ready);

    expect(snackBar.open).not.toHaveBeenCalled();
  });
});
