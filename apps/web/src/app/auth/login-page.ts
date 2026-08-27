import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { apiErrorMessage } from '../api-error-message';
import { returnUrlTree } from '../safe-return-url';
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
  private readonly formBuilder = inject(FormBuilder);

  /**
   * Where the admin was heading before the guard sent them here. The router fills this in
   * from the query string (`withComponentInputBinding`), so the deep link a bookmark pointed
   * at survives the detour instead of being replaced by a fixed landing page.
   */
  readonly returnUrl = input<string>();

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly passwordMinLength = authConstraints.passwordMinLength;
  protected readonly passwordMaxLength = authConstraints.passwordMaxLength;
  protected readonly emailMaxLength = authConstraints.emailMaxLength;

  /** The limits are the contract's own, imported rather than restated next to the inputs. */
  protected readonly form = this.formBuilder.nonNullable.group({
    email: [
      '',
      [Validators.required, Validators.email, Validators.maxLength(authConstraints.emailMaxLength)],
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(authConstraints.passwordMinLength),
        Validators.maxLength(authConstraints.passwordMaxLength),
      ],
    ],
    rememberMe: [false],
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
      await this.router.navigateByUrl(returnUrlTree(this.router, this.returnUrl()));
    } catch (error: unknown) {
      this.showFailure(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private showFailure(error: unknown): void {
    this.formError.set(apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE));
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
