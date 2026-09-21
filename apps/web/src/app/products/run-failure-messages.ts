import type { PreparationRunDto } from '@contracts/ai.contract';

/**
 * `errorCode` of a finished run, which is a different vocabulary from an HTTP failure. The card
 * dialog shows it the moment a run fails, the catalogue lists it afterwards (T50), and both have
 * to word the same failure alike.
 */
export const runFailureMessages: Readonly<
  Record<NonNullable<PreparationRunDto['errorCode']>, string>
> = {
  price_unavailable: 'Ціну знайти не вдалося. Тексти на місці — спробуйте запросити ціну ще раз.',
  preparation_failed: 'Підготовка не вдалася. Спробуйте ще раз.',
};
