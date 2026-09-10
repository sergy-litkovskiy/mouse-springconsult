import type { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  productConstraints,
  productPagination,
  productSortDefaults,
  productSortDirections,
  productSortFields,
  type ProductSortDirection,
  type ProductSortField,
} from '@contracts/products-limits';

/**
 * What an acceptable filter value is, asked at the three boundaries the catalogue has: the
 * address bar, the filter form and the request. None of it can live on the component — an
 * `input()` transform runs before there is an instance to call a method on, and a `ValidatorFn`
 * is a plain function by definition — and keeping it in one file is what keeps the transform's
 * reading of `productConstraints` and the validator's from drifting apart.
 *
 * A query parameter is whatever the address bar happens to hold, typed by hand as often as it is
 * written by the paginator, so anything the contract does not accept falls back to the default
 * here rather than travelling to the server to be refused.
 */
export function toPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : productPagination.defaultPage;
}

export function toPageSize(value: string | undefined): number {
  const size = Number(value);
  return Number.isInteger(size) && size > 0 && size <= productPagination.maxPageSize
    ? size
    : productPagination.defaultPageSize;
}

export function toSortField(value: string | undefined): ProductSortField {
  return isSortField(value) ? value : productSortDefaults.field;
}

export function toSortDirection(value: string | undefined): ProductSortDirection {
  return isSortDirection(value) ? value : productSortDefaults.direction;
}

/** A factory because the bound differs per field and an `input()` transform takes only the value. */
export function textFilter(maxLength: number): (value: string | undefined) => string | undefined {
  return (value) => {
    const cleaned = value?.trim() ?? '';
    return cleaned === '' || cleaned.length > maxLength ? undefined : cleaned;
  };
}

/**
 * The same expression the backend validates with, applied here so that "1000.555" is dropped by
 * the page that produced it instead of coming back as a `validation_failed` that names no field.
 */
export function toPriceFilter(value: string | undefined): string | undefined {
  const cleaned = value?.trim() ?? '';
  return productConstraints.pricePattern.test(cleaned) ? cleaned : undefined;
}

export function toPublishedFilter(value: string | undefined): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  return value === 'false' ? false : undefined;
}

/** An empty field is not a filter, and `null` is how the router is told to drop a parameter. */
export function asQueryParam(value: string): string | null {
  const cleaned = value.trim();
  return cleaned === '' ? null : cleaned;
}

export function publishedControlValue(published: boolean | undefined): '' | 'true' | 'false' {
  if (published === undefined) {
    return '';
  }
  return published ? 'true' : 'false';
}

export function priceBound(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  return value === '' || productConstraints.pricePattern.test(value) ? null : { price: true };
}

/**
 * Comparing two bounds is not converting them: the strings are what travel to the API, and
 * `Number` reads a value here without ever storing or sending one.
 */
export function priceRange(group: AbstractControl): ValidationErrors | null {
  const min = (group.get('priceMin')?.value as string | undefined)?.trim() ?? '';
  const max = (group.get('priceMax')?.value as string | undefined)?.trim() ?? '';
  const bothValid =
    productConstraints.pricePattern.test(min) && productConstraints.pricePattern.test(max);
  if (!bothValid) {
    return null;
  }
  return Number(min) <= Number(max) ? null : { priceRange: true };
}

function isSortField(value: string | undefined): value is ProductSortField {
  return value !== undefined && (productSortFields as readonly string[]).includes(value);
}

function isSortDirection(value: string | undefined): value is ProductSortDirection {
  return value !== undefined && (productSortDirections as readonly string[]).includes(value);
}
