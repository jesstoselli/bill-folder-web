import { defer, Observable, tap } from 'rxjs';
import { DataChangeService } from './data-change.service';

export function notifyingWrite<T>(
  changes: DataChangeService,
  operation: Observable<T>,
): Observable<T> {
  return defer(() => {
    let notified = false;

    return operation.pipe(
      tap({
        next: () => {
          if (!notified) {
            notified = true;
            changes.notify();
          }
        },
      }),
    );
  });
}
