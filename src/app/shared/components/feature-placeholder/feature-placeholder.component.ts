import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

@Component({
  selector: 'app-feature-placeholder',
  template: `
    <section class="feature-placeholder" [attr.aria-labelledby]="titleId">
      <span class="feature-placeholder__rule" aria-hidden="true"></span>
      <h1 [id]="titleId">{{ title() }}</h1>
      <p>Estrutura pronta para as próximas etapas do MVP.</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .feature-placeholder {
      align-content: center;
      min-height: min(36rem, calc(100dvh - 6rem));
      padding-block: clamp(3rem, 12vh, 8rem);
    }

    .feature-placeholder__rule {
      background: var(--bf-brand);
      border-radius: var(--bf-radius-pill);
      display: block;
      height: 0.3rem;
      margin-bottom: 1.5rem;
      width: 3.5rem;
    }

    h1 {
      color: var(--bf-text);
      font-size: clamp(2.75rem, 8vw, 6.5rem);
      font-weight: 500;
      letter-spacing: -0.045em;
      line-height: 0.88;
      margin: 0;
      max-width: 12ch;
    }

    p {
      color: var(--bf-muted);
      font-size: 1.05rem;
      margin: 1.5rem 0 0;
      max-width: 34ch;
    }
  `,
})
export class FeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly titleId = 'feature-title';
  protected readonly title = toSignal(
    this.route.data.pipe(map((data) => (data['title'] as string | undefined) ?? 'BillFolder')),
    { initialValue: 'BillFolder' },
  );
}
