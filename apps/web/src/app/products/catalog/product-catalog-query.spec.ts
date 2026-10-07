import { FormControl, FormGroup } from '@angular/forms';
import { productConstraints } from '@contracts/products-limits';
import {
  isEnoughForPriceFilter,
  normalizePrice,
  priceBound,
  priceFromField,
  priceRange,
  toCategoryFilter,
} from './product-catalog-query';

describe('toCategoryFilter', () => {
  it('reads a single category of a saved address as a list of one', () => {
    expect(toCategoryFilter('Миші')).toEqual(['Миші']);
  });

  it('reads repeated categories as a list in the order the address holds them', () => {
    expect(toCategoryFilter(['Миші', 'Навушники'])).toEqual(['Миші', 'Навушники']);
  });
});

/** A thousands separator, a second comma and a third decimal: none of them is a decimal comma. */
const NOT_A_DECIMAL_COMMA = ['1,000.50', '2,5,0', '235,505'];

describe('normalizePrice', () => {
  it('turns the decimal comma into a dot and trims the value', () => {
    expect(normalizePrice('235,50')).toBe('235.50');
    expect(normalizePrice('  235,50  ')).toBe('235.50');
    expect(normalizePrice('235.50')).toBe('235.50');
  });
});

describe('priceBound', () => {
  it('takes a comma as the decimal separator and nothing else', () => {
    expect(priceBound(new FormControl('235,50'))).toBeNull();
    for (const value of NOT_A_DECIMAL_COMMA) {
      expect(priceBound(new FormControl(value)), value).toEqual({ price: true });
    }
  });
});

describe('isEnoughForPriceFilter', () => {
  it('takes a bound with at least two whole digits, written with a dot or a comma', () => {
    for (const value of ['10', '1000', '10.5', '10,50', ' 25 ']) {
      expect(isEnoughForPriceFilter(value), value).toBe(true);
    }
  });

  it('takes no bound with one whole digit or of a shape the contract rejects', () => {
    for (const value of ['1', '5.50', '1,5', '1000.555', ...NOT_A_DECIMAL_COMMA]) {
      expect(isEnoughForPriceFilter(value), value).toBe(false);
    }
  });
});

describe('priceRange', () => {
  function bounds(priceMin: string, priceMax: string): FormGroup {
    return new FormGroup({
      priceMin: new FormControl(priceMin),
      priceMax: new FormControl(priceMax),
    });
  }

  it('compares bounds typed with a decimal comma', () => {
    expect(priceRange(bounds('300,5', '200'))).toEqual({ priceRange: true });
    expect(priceRange(bounds('100,5', '200,25'))).toBeNull();
  });
});

describe('priceFromField', () => {
  it('hands the contract a dot for a decimal comma and nothing it accepts otherwise', () => {
    expect(priceFromField('235,50')).toBe('235.50');
    expect(priceFromField(' 235,50 ')).toBe('235.50');
    for (const value of NOT_A_DECIMAL_COMMA) {
      expect(productConstraints.pricePattern.test(priceFromField(value)), value).toBe(false);
    }
  });
});
