import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { authConstraints } from '@contracts/auth-limits';
import { apiErrorCodes } from '@contracts/error-codes';
import type { ApiError } from '@contracts/error.contract';
import { AuthStore } from './auth-store';

/**
 * Sign-in form. The texts are Ukrainian with no translation layer: the admin panel is
 * monolingual, and i18n infrastructure would cost more here than it is worth.
 *
 * The server response carries only an error code; the human wording is the UI's business.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.invalidCredentials]: 'Невірний email або пароль.',
  [apiErrorCodes.userDeactivated]: 'Обліковий запис вимкнено. Зверніться до адміністратора.',
  [apiErrorCodes.tooManyRequests]: 'Забагато спроб входу. Спробуйте за кілька хвилин.',
  [apiErrorCodes.validationFailed]: 'Перевірте правильність заповнення полів.',
};

const NETWORK_ERROR_MESSAGE = 'Немає зв’язку із сервером. Перевірте мережу і спробуйте ще раз.';
const UNKNOWN_ERROR_MESSAGE = 'Не вдалося увійти. Спробуйте ще раз.';

/** The error the server pins on both fields: hinting which one is wrong is not allowed. */
const CREDENTIALS_ERROR = { credentials: true } as const;

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly passwordMinLength = authConstraints.passwordMinLength;

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(authConstraints.passwordMinLength)],
    }),
    rememberMe: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    // As soon as the user starts editing, the server error no longer describes what is in
    // the fields — so it disappears together with the first keystroke.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.formError() !== null) {
        this.formError.set(null);
        this.clearCredentialsError();
      }
    });
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigate(['/welcome']);
    } catch (error: unknown) {
      this.showFailure(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private showFailure(error: unknown): void {
    this.formError.set(toMessage(error));
    this.form.controls.email.setErrors(CREDENTIALS_ERROR);
    this.form.controls.password.setErrors(CREDENTIALS_ERROR);
    this.form.controls.email.markAsTouched();
    this.form.controls.password.markAsTouched();
  }

  private clearCredentialsError(): void {
    for (const control of [this.form.controls.email, this.form.controls.password]) {
      if (control.hasError('credentials')) {
        control.updateValueAndValidity({ emitEvent: false });
      }
    }
  }
}

function toMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return UNKNOWN_ERROR_MESSAGE;
  }
  if (error.status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }

  const code = (error.error as ApiError | null)?.error.code;
  return (code === undefined ? undefined : ERROR_MESSAGES[code]) ?? UNKNOWN_ERROR_MESSAGE;
}
