import { toCategoryFilter } from './product-catalog-query';

describe('toCategoryFilter', () => {
  it('reads a single category of a saved address as a list of one (AC-56)', () => {
    expect(toCategoryFilter('Миші')).toEqual(['Миші']);
  });

  it('reads repeated categories as a list in the order the address holds them (AC-56)', () => {
    expect(toCategoryFilter(['Миші', 'Навушники'])).toEqual(['Миші', 'Навушники']);
  });
});
