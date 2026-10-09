import { Component, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { ButtonComponent } from '../../components/button/button.component';
import { InlineAlertComponent } from '../../components/inline-alert/inline-alert.component';

/**
 * Shared shell for form dialogs. The host dialog keeps its own
 * `<form [formGroup] (ngSubmit)>` around this frame (projected fields only see
 * a formGroup declared in their own template); the frame owns the header,
 * the server error, the scrollable body and the Cancel/Submit actions.
 * A subtitle can be projected with the `dialogSubtitle` attribute.
 */
@Component({
  selector: 'app-dialog-frame',
  imports: [MatDialogModule, ButtonComponent, InlineAlertComponent],
  template: `
    <header class="dialog-frame__header">
      <div>
        <h2 [id]="titleId()" mat-dialog-title>{{ heading() }}</h2>
        <ng-content select="[dialogSubtitle]" />
      </div>
      <button
        type="button"
        appButton
        variant="text"
        mat-dialog-close
        [aria-label]="closeLabel()"
        [disabled]="saving()"
      >
        Fechar
      </button>
    </header>

    <mat-dialog-content>
      <app-inline-alert class="dialog-frame__error" [message]="error()" />
      <ng-content />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" appButton variant="text" mat-dialog-close [disabled]="saving()">
        Cancelar
      </button>
      <button type="submit" appButton variant="primary" [disabled]="saving() || submitDisabled()">
        {{ saving() ? savingLabel() : submitLabel() }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      max-height: 100dvh;
    }

    .dialog-frame__header {
      align-items: start;
      border-bottom: 1px solid var(--bf-outline);
      display: flex;
      gap: 1rem;
      justify-content: space-between;
      padding: 1.25rem 1.5rem 1rem;
    }

    h2 {
      font-size: 1.65rem;
      font-weight: 500;
      letter-spacing: -0.02em;
      margin: 0;
      padding: 0;
    }

    mat-dialog-content {
      overflow-y: auto;
      padding-top: 1.25rem;
    }

    .dialog-frame__error {
      margin-bottom: 1rem;
    }

    mat-dialog-actions {
      background: var(--bf-surface);
      border-top: 1px solid var(--bf-outline);
    }

    @media (max-width: 560px) {
      .dialog-frame__header {
        padding-inline: 1rem;
      }
    }
  `,
})
export class DialogFrameComponent {
  readonly titleId = input.required<string>();
  readonly heading = input.required<string>();
  readonly closeLabel = input('Fechar');
  readonly saving = input(false);
  readonly submitLabel = input('Salvar');
  readonly savingLabel = input('Salvando…');
  readonly submitDisabled = input(false);
  readonly error = input<string | null | undefined>('');
}
