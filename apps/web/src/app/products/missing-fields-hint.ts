import type { ProductCard } from '@contracts/products.contract';

/**
 * Only the list of gaps is worked out here; whether the card is ready is the server's answer
 * (ADR 0009). The catalogue and the open card share it so that both name the gaps alike (AC-15).
 */
export function missingFieldsHint(product: ProductCard): string {
  const missing = [
    product.titleProm === '' ? 'заголовок Prom' : null,
    product.descriptionProm === '' ? 'опис Prom' : null,
    product.titleOlx === '' ? 'заголовок OLX' : null,
    product.descriptionOlx === '' ? 'опис OLX' : null,
    // Same test as the server's: the decimal string never becomes a number, so any non-zero
    // digit means the price is above zero.
    /[1-9]/.test(product.price) ? null : 'ціна',
    product.images.length === 0 ? 'галерея' : null,
  ].filter((gap) => gap !== null);
  return missing.length === 0 ? '' : `Бракує: ${missing.join(', ')}`;
}
