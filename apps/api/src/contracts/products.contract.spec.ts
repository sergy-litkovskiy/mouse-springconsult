import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { productListQuerySchema } from './products.contract.ts';
import { productPagination } from './products-limits.ts';

describe('product list query contract', () => {
  it('applies pagination and sorting defaults to an empty query', () => {
    const parsed = productListQuerySchema.parse({});

    assert.equal(parsed.page, productPagination.defaultPage);
    assert.equal(parsed.pageSize, productPagination.defaultPageSize);
    assert.equal(parsed.sort, 'titleProm');
    assert.equal(parsed.direction, 'asc');
  });

  it('coerces the numbers a querystring delivers as strings', () => {
    const parsed = productListQuerySchema.parse({ page: '3', pageSize: '10' });

    assert.equal(parsed.page, 3);
    assert.equal(parsed.pageSize, 10);
  });

  it('leaves the price bounds as the decimal strings they arrive as', () => {
    // Coercion is what the price must not go through: `decimal(12,2)` keeps the value,
    // and a round trip through a JS number is exactly the rounding that loses it.
    const parsed = productListQuerySchema.parse({ priceMin: '500.00', priceMax: '1500.50' });

    assert.equal(parsed.priceMin, '500.00');
    assert.equal(parsed.priceMax, '1500.50');
  });

  it('refuses a price that is not a decimal the column can hold', () => {
    for (const priceMin of ['2499.999', '-1.00', '12345678901.00', 'дешево', '']) {
      assert.equal(
        productListQuerySchema.safeParse({ priceMin }).success,
        false,
        `${priceMin} must be rejected`,
      );
    }
  });

  it('reads published=false as false rather than as a truthy string', () => {
    // z.coerce.boolean() would return true here: Boolean('false') is true. That is the
    // whole reason the flag is spelled out in the contract.
    assert.equal(productListQuerySchema.parse({ published: 'false' }).published, false);
    assert.equal(productListQuerySchema.parse({ published: 'true' }).published, true);
  });

  it('refuses a page size above the ceiling instead of silently clamping it', () => {
    const result = productListQuerySchema.safeParse({
      pageSize: String(productPagination.maxPageSize + 1),
    });

    assert.equal(result.success, false);
  });

  it('refuses a sort column that is not on the list', () => {
    // The value ends up in an ORDER BY, so an open string has no business getting here.
    assert.equal(productListQuerySchema.safeParse({ sort: 'createdAt' }).success, false);
    assert.equal(productListQuerySchema.safeParse({ direction: 'sideways' }).success, false);
  });

  it('trims text filters and rejects one that is only whitespace', () => {
    assert.equal(productListQuerySchema.parse({ title: '  миша  ' }).title, 'миша');
    assert.equal(productListQuerySchema.safeParse({ title: '   ' }).success, false);
  });

  it('leaves an absent filter absent instead of inventing a default', () => {
    const parsed = productListQuerySchema.parse({ page: '1' });

    assert.equal(Object.hasOwn(parsed, 'title'), false);
    assert.equal(Object.hasOwn(parsed, 'published'), false);
  });
});
