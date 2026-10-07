import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../../core/auth/auth.api';
import { authErrorMessage } from '../auth-form-errors';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
})
export class ResetPasswordPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly email = inject(ActivatedRoute).snapshot.queryParamMap.get('email')?.trim() ?? '';
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });

  submit(): void {
    if (!this.email || this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.email) {
        this.errorMessage.set('Abra o link de recuperação enviado para o seu email.');
        return;
      }
      this.focusFirstInvalidField();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.api
      .resetPassword({ email: this.email, ...this.form.getRawValue() })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/login'),
        error: (error: unknown) => {
          this.errorMessage.set(
            authErrorMessage(error, 'Não foi possível redefinir a senha. Tente novamente.'),
          );
        },
      });
  }

  private focusFirstInvalidField(): void {
    const id = this.form.controls.code.invalid ? '#reset-code' : '#reset-password';
    this.host.nativeElement.querySelector<HTMLInputElement>(id)?.focus();
  }
}
