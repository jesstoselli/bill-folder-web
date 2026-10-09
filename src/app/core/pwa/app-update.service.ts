import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent } from 'rxjs';

/**
 * The service worker installs a new deploy in the background but keeps
 * serving the cached bundle. Without this the new version only shows up on
 * a later load, so we offer the reload as soon as it is ready.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private prompted = false;

  start(): void {
    if (!this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.offerReload());

    this.updates.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    fromEvent(this.document, 'visibilitychange')
      .pipe(
        filter(() => this.document.visibilityState === 'visible'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.updates.checkForUpdate().catch(() => false));
  }

  private offerReload(): void {
    if (this.prompted) {
      return;
    }
    this.prompted = true;

    // Asking instead of reloading on our own: a dialog with unsaved input
    // may be open.
    this.snackBar
      .open('Nova versão do BillFolder disponível.', 'Atualizar')
      .onAction()
      .subscribe(() => {
        void this.updates
          .activateUpdate()
          .catch(() => false)
          .then(() => this.reload());
      });
  }

  private reload(): void {
    this.document.defaultView?.location.reload();
  }
}
