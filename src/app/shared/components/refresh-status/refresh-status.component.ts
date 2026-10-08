import { Component, input, output } from '@angular/core';
import { LoadState } from '../../states/load-state';

@Component({
  selector: 'app-refresh-status',
  templateUrl: './refresh-status.component.html',
  styleUrl: './refresh-status.component.scss',
})
export class RefreshStatusComponent {
  readonly state = input.required<LoadState<unknown>>();
  readonly retry = output<void>();

  protected failure(): { readonly message: string; readonly lastSuccessfulAt?: number } | null {
    const state = this.state();
    return state.kind === 'content' && state.refreshError
      ? { message: state.refreshError, lastSuccessfulAt: state.lastSuccessfulAt }
      : null;
  }

  protected lastSuccess(timestamp: number | undefined): string {
    if (!timestamp) return 'conteúdo anterior preservado';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  }
}
