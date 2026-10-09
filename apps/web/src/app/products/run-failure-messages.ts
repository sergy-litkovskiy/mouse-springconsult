import type { PreparationRunDto } from '@contracts/ai.contract';

/**
 * `errorCode` of a finished run, which is a different vocabulary from an HTTP failure. The card
 * dialog shows it the moment a run fails, the catalogue lists it afterwards, and both have
 * to word the same failure alike.
 */
export const runFailureMessages: Readonly<
  Record<NonNullable<PreparationRunDto['errorCode']>, string>
> = {
  price_unavailable: 'Ціну знайти не вдалося. Тексти на місці — спробуйте запросити ціну ще раз.',
  price_not_found: 'Вилку не знайдено — повторіть чи уточніть назву.',
  price_quota_exhausted: 'Ліміт пошуку на сьогодні вичерпано — спробуйте наступного дня.',
  preparation_failed: 'Підготовка не вдалася. Спробуйте ще раз.',
};
