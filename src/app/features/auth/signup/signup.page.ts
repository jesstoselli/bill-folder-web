import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { authErrorMessage } from '../auth-form-errors';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-signup-page',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, MatFormFieldModule, MatInputModule],
  templateUrl: './signup.page.html',
  styleUrl: './signup.page.scss',
})
export class SignupPage {
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });

  submit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.session
      .signup(this.form.getRawValue())
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/home'),
        error: (error: unknown) => {
          this.errorMessage.set(
            authErrorMessage(error, 'Não foi possível criar a conta. Tente novamente.'),
          );
        },
      });
  }

  private focusFirstInvalidField(): void {
    const id = this.form.controls.displayName.invalid
      ? '#signup-name'
      : this.form.controls.email.invalid
        ? '#signup-email'
        : '#signup-password';
    this.host.nativeElement.querySelector<HTMLInputElement>(id)?.focus();
  }
}
