import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { PreparationRunDto } from '@contracts/ai.contract';
import { apiErrorCodes } from '@contracts/error-codes';
import { apiErrorMessage } from '../../api-error-message';
import { ProductsApi } from '../products-api';
import { runFailureMessages } from '../run-failure-messages';

export type PreparationFailuresData = {
  readonly productId: string;
  readonly title: string;
};

const SCOPE_LABELS: Readonly<Record<PreparationRunDto['scope'], string>> = {
  texts: 'Тексти',
  price: 'Ціна',
  both: 'Тексти й ціна',
  field: 'Одне поле',
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.productNotFound]: 'Картку вже видалено.',
};

const UNKNOWN_ERROR_MESSAGE = 'Не вдалося завантажити відмови. Спробуйте ще раз.';

const timeFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' });

/** Looking only: a repeat of the run stays in the card dialog (AC-23). */
@Component({
  selector: 'app-preparation-failures',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  templateUrl: './preparation-failures.html',
  styleUrl: './preparation-failures.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreparationFailures {
  private readonly api = inject(ProductsApi);
  protected readonly data = inject<PreparationFailuresData>(MAT_DIALOG_DATA);

  private readonly failures = httpResource<PreparationRunDto[]>(() =>
    this.api.failedRunsRequest(this.data.productId),
  );

  protected readonly runs = computed<readonly PreparationRunDto[]>(() =>
    this.failures.hasValue() ? this.failures.value() : [],
  );
  protected readonly loading = this.failures.isLoading;
  protected readonly loadError = computed(() => {
    const error = this.failures.error();
    return error === undefined
      ? null
      : apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE);
  });

  protected scopeLabel(run: PreparationRunDto): string {
    return SCOPE_LABELS[run.scope];
  }

  /** Every failed run carries a code; the fallback only satisfies the nullable type. */
  protected message(run: PreparationRunDto): string {
    return runFailureMessages[run.errorCode ?? 'preparation_failed'];
  }

  protected time(run: PreparationRunDto): string {
    return timeFormat.format(new Date(run.finishedAt ?? run.createdAt));
  }

  protected retry(): void {
    this.failures.reload();
  }
}
