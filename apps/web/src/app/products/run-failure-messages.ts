import type { PreparationRunDto } from '@contracts/ai.contract';

/**
 * `errorCode` of a finished run, which is a different vocabulary from an HTTP failure. The card
 * dialog shows it the moment a run fails, the catalogue lists it afterwards, and both have
 * to word the same failure alike.
 */
const runFailureMessages: Readonly<Record<NonNullable<PreparationRunDto['errorCode']>, string>> = {
  price_unavailable: 'Ціну знайти не вдалося. Тексти на місці — спробуйте запросити ціну ще раз.',
  price_not_found: 'Вилку не знайдено — повторіть чи уточніть назву.',
  price_quota_exhausted: 'Ліміт пошуку на сьогодні вичерпано — спробуйте наступного дня.',
  preparation_failed: 'Підготовка не вдалася. Спробуйте ще раз.',
};

/** A price-only run had no texts to keep, so its `price_unavailable` does not mention them. */
export function runFailureMessage(
  run: Pick<PreparationRunDto, 'scope'> & {
    readonly errorCode: NonNullable<PreparationRunDto['errorCode']>;
  },
): string {
  return run.scope === 'price' && run.errorCode === 'price_unavailable'
    ? 'Пошук ціни не пройшов — спробуйте ще раз.'
    : runFailureMessages[run.errorCode];
}
