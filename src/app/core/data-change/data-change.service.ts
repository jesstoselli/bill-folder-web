import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DataChangeService {
  private readonly value = signal(0);
  readonly version = this.value.asReadonly();

  notify(): void {
    this.value.update((version) => version + 1);
  }
}
