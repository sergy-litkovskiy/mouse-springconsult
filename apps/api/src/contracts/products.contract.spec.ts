import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  productCreateSchema,
  productListQuerySchema,
  productUpdateResponseSchema,
  productUpdateSchema,
} from './products.contract.ts';
import { productConstraints, productPagination } from './products-limits.ts';

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

  it('reads publishedProm=false as false rather than as a truthy string', () => {
    // z.coerce.boolean() would return true here: Boolean('false') is true. That is the
    // whole reason the flag is spelled out in the contract.
    assert.equal(productListQuerySchema.parse({ publishedProm: 'false' }).publishedProm, false);
    assert.equal(productListQuerySchema.parse({ publishedProm: 'true' }).publishedProm, true);
  });

  it('keeps the two marketplaces independent of each other', () => {
    const parsed = productListQuerySchema.parse({ publishedProm: 'true', publishedOlx: 'false' });

    assert.equal(parsed.publishedProm, true);
    assert.equal(parsed.publishedOlx, false);

    const promOnly = productListQuerySchema.parse({ publishedProm: 'true' });
    assert.equal(Object.hasOwn(promOnly, 'publishedOlx'), false);
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
    assert.equal(Object.hasOwn(parsed, 'publishedProm'), false);
  });
});

describe('product write contracts', () => {
  const newCard = { titleProm: 'Миша', titleOlx: 'Миша', category: 'Периферія' };

  it('requires of a new card exactly the columns that have no default', () => {
    // title_prom, title_olx and category are NOT NULL without a default; everything else
    // the table fills in, so the schema fills it in the same way.
    const parsed = productCreateSchema.parse(newCard);

    assert.equal(parsed.descriptionProm, '');
    assert.equal(parsed.descriptionOlx, '');
    assert.equal(parsed.price, '0.00');
    assert.deepEqual(parsed.seoKeywords, []);
    assert.equal(parsed.condition, 'used');
  });

  it('refuses a card without a title or with one that is only whitespace', () => {
    assert.equal(
      productCreateSchema.safeParse({ ...newCard, titleProm: undefined }).success,
      false,
    );
    assert.equal(productCreateSchema.safeParse({ ...newCard, titleProm: '   ' }).success, false);
    assert.equal(productCreateSchema.safeParse({ ...newCard, category: '' }).success, false);
    assert.equal(productUpdateSchema.safeParse({ titleOlx: '  ' }).success, false);
  });

  it('refuses a price the column cannot hold, on both write routes (AC-09)', () => {
    for (const price of ['2499.999', '-1.00', '12345678901.00', 'дешево']) {
      assert.equal(
        productCreateSchema.safeParse({ ...newCard, price }).success,
        false,
        `${price} must be rejected on create`,
      );
      assert.equal(
        productUpdateSchema.safeParse({ price }).success,
        false,
        `${price} must be rejected on update`,
      );
    }
  });

  it('accepts the thirty-first keyword instead of rejecting it (AC-07)', () => {
    // Trimming past the ceiling belongs to the service. A schema that refused the excess
    // here would leave the service nothing to trim and AC-07 nothing to describe.
    const tooMany = Array.from(
      { length: productConstraints.maxKeywords + 1 },
      (_, i) => `слово${String(i)}`,
    );

    assert.equal(
      productCreateSchema.parse({ ...newCard, seoKeywords: tooMany }).seoKeywords.length,
      31,
    );
    assert.equal(productUpdateSchema.parse({ seoKeywords: tooMany }).seoKeywords?.length, 31);
  });

  it('leaves a field the update did not send out of the parsed object', () => {
    // A default here would rewrite a column the admin never touched.
    const parsed = productUpdateSchema.parse({ price: '2499.00' });

    assert.equal(parsed.price, '2499.00');
    assert.equal(Object.hasOwn(parsed, 'titleProm'), false);
    assert.equal(Object.hasOwn(parsed, 'condition'), false);
  });

  it('keeps the two publication marks independent of each other (AC-13)', () => {
    const parsed = productUpdateSchema.parse({ publishedProm: true, publishedOlx: false });

    assert.equal(parsed.publishedProm, true);
    assert.equal(parsed.publishedOlx, false);

    const olxOnly = productUpdateSchema.parse({ publishedOlx: true });
    assert.equal(Object.hasOwn(olxOnly, 'publishedProm'), false);
  });

  it('carries both derived fields in the update response', () => {
    const card = {
      id: '0199c0de-0000-7000-8000-000000000001',
      titleProm: 'Миша',
      descriptionProm: 'Опис',
      titleOlx: 'Миша',
      descriptionOlx: 'Опис',
      price: '2499.00',
      seoKeywords: ['миша'],
      category: 'Периферія',
      publishedProm: false,
      publishedOlx: false,
      condition: 'used',
      images: [],
      createdAt: '2026-09-09T10:00:00.000Z',
      updatedAt: '2026-09-09T10:00:00.000Z',
      isReady: false,
      discardedKeywordsCount: 1,
    };

    assert.equal(productUpdateResponseSchema.parse(card).discardedKeywordsCount, 1);
    assert.equal(productUpdateResponseSchema.parse(card).isReady, false);

    const withoutReadiness: Record<string, unknown> = { ...card };
    delete withoutReadiness['isReady'];
    assert.equal(productUpdateResponseSchema.safeParse(withoutReadiness).success, false);
  });
});
