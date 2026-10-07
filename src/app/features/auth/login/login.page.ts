import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { safeInternalReturnUrl } from '../../../core/auth/auth.guard';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { authErrorMessage } from '../auth-form-errors';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.session
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          const requested = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(safeInternalReturnUrl(requested) ?? '/home');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            authErrorMessage(error, 'Não foi possível entrar. Tente novamente.'),
          );
        },
      });
  }

  private focusFirstInvalidField(): void {
    const id = this.form.controls.email.invalid ? '#login-email' : '#login-password';
    this.host.nativeElement.querySelector<HTMLInputElement>(id)?.focus();
  }
}
