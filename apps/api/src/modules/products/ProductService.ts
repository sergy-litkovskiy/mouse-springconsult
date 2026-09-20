import { randomUUID } from 'node:crypto';
import type {
  ProductCreate,
  ProductListQuery,
  ProductUpdate,
} from '../../contracts/products.contract.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import type { MediaService } from '../media/index.ts';
import { cleanDescription } from './cleanDescription.ts';
import type { FieldSuggestion, SuggestionField, SuggestionValue } from './FieldSuggestion.ts';
import type { PreparationRepository, TokenTotals } from './PreparationRepository.ts';
import type { Product, ProductPage } from './Product.ts';
import {
  GalleryFull,
  ImageNotFound,
  PriceSuggestionReadonly,
  ProductNotFound,
  SuggestionAlreadyResolved,
  SuggestionNotFound,
} from './ProductErrors.ts';
import type { ProductImage } from './ProductImage.ts';
import type {
  ProductChanges,
  ProductDraft,
  ProductListCriteria,
  ProductRepository,
} from './ProductRepository.ts';

/** Readiness is derived on read and never stored (ADR 0009). */
export type ProductReading = {
  readonly product: Product;
  readonly isReady: boolean;
};

/** The cost of a card is summed over its runs on read and never stored as a number (ADR 0006). */
export type ProductCardReading = ProductReading & {
  readonly tokens: TokenTotals;
};

/** Keywords past the ceiling are reported here rather than raised as an error (AC-07). */
export type ProductSaving = ProductReading & {
  readonly discardedKeywordsCount: number;
};

/**
 * The Prom description is HTML in the card and plain text in a suggestion (ADR 0016): the text is
 * escaped, blocks between blank lines become paragraphs, a lone newline becomes a break, and the
 * result passes the very cleaning a description typed by hand goes through.
 */
function promDescription(text: string): string {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return cleanDescription(
    escaped
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replaceAll('\n', '<br>')}</p>`)
      .join(''),
  );
}

/**
 * `null` for a value no column can take: `price` is a range and `products.price` a scalar, so a
 * price suggestion never reaches the card through this route at all (AC-26).
 */
function suggestionChanges(field: SuggestionField, value: SuggestionValue): ProductChanges | null {
  if (field === 'seo_keywords') {
    return Array.isArray(value) ? { seoKeywords: [...value] } : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  switch (field) {
    case 'title_prom':
      return { titleProm: value };
    case 'title_olx':
      return { titleOlx: value };
    case 'description_prom':
      return { descriptionProm: promDescription(value) };
    case 'description_olx':
      return { descriptionOlx: value };
    case 'price':
      return null;
  }
}

/** Every column reachable this way holds a string or a list of strings, and JSON compares both. */
function cardHolds(product: Product, changes: ProductChanges): boolean {
  return Object.entries(changes).every(
    ([column, value]) => JSON.stringify(product[column as keyof Product]) === JSON.stringify(value),
  );
}

function capKeywords(keywords: string[]): {
  seoKeywords: string[];
  discardedKeywordsCount: number;
} {
  const seoKeywords = keywords.slice(0, productConstraints.maxKeywords);
  return { seoKeywords, discardedKeywordsCount: keywords.length - seoKeywords.length };
}

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly media: MediaService,
    private readonly preparations: PreparationRepository,
  ) {}

  /**
   * A filter that was not sent does not become a condition: zod leaves an absent `.optional()`
   * field out of the object entirely, so what is left once the four pagination keys are taken
   * out is exactly the set of filters that arrived.
   */
  async list(query: ProductListQuery): Promise<ProductPage> {
    const { page, pageSize, sort, direction, ...filters } = query;
    const criteria: ProductListCriteria = { page, pageSize, sort, direction, filters };

    return this.products.list(criteria);
  }

  /**
   * Reading writes here, and that is the choice of sad.md §6, scenario 9: the check against the
   * last accepted suggestion lives on the read of the card. While a field still holds what was
   * accepted for it last — an untouched field holds the empty value it was born with — a fresh
   * suggestion applies itself; once the two differ, the field was edited by hand and the
   * suggestion waits for a decision (AC-11).
   */
  async getById(id: string): Promise<ProductCardReading> {
    let product = await this.products.findById(id);
    if (product === null) {
      throw new ProductNotFound(id);
    }

    const accepted = new Map<SuggestionField, FieldSuggestion>();
    const pending = new Map<SuggestionField, FieldSuggestion>();
    // Oldest first, so the last one put in is the latest of its field.
    for (const suggestion of await this.preparations.findSuggestions(id)) {
      if (suggestion.resolution === 'accepted') {
        accepted.set(suggestion.field, suggestion);
      } else if (suggestion.resolution === null) {
        pending.set(suggestion.field, suggestion);
      }
    }

    const changes: ProductChanges = {};
    const applied: FieldSuggestion[] = [];
    for (const [field, suggestion] of pending) {
      const suggested = suggestionChanges(field, suggestion.value);
      const previous = accepted.get(field)?.value ?? (field === 'seo_keywords' ? [] : '');
      const baseline = suggestionChanges(field, previous);
      if (suggested === null || baseline === null || !cardHolds(product, baseline)) {
        continue;
      }
      Object.assign(changes, suggested);
      applied.push(suggestion);
    }

    if (applied.length > 0) {
      for (const suggestion of applied) {
        await this.preparations.resolveSuggestion(suggestion.id, 'accepted');
      }
      const saved = await this.products.update(id, changes);
      if (saved === null) {
        throw new ProductNotFound(id);
      }
      product = saved;
    }

    return {
      product,
      isReady: this.isReady(product),
      tokens: await this.preparations.sumTokens(id),
    };
  }

  /** The value reaches the card through the same save as a manual edit (AC-12). */
  async acceptSuggestion(productId: string, suggestionId: string): Promise<ProductCardReading> {
    const suggestion = await this.preparations.findSuggestion(productId, suggestionId);
    if (suggestion === null) {
      throw new SuggestionNotFound(suggestionId);
    }

    const changes = suggestionChanges(suggestion.field, suggestion.value);
    // Refused before anything is written: `products.price` is not touched by this route (AC-26).
    if (changes === null) {
      throw new PriceSuggestionReadonly();
    }

    if (!(await this.preparations.resolveSuggestion(suggestionId, 'accepted'))) {
      throw new SuggestionAlreadyResolved(suggestionId);
    }

    const product = await this.products.update(productId, changes);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    return {
      product,
      isReady: this.isReady(product),
      tokens: await this.preparations.sumTokens(productId),
    };
  }

  async rejectSuggestion(productId: string, suggestionId: string): Promise<ProductCardReading> {
    const suggestion = await this.preparations.findSuggestion(productId, suggestionId);
    if (suggestion === null) {
      throw new SuggestionNotFound(suggestionId);
    }

    if (!(await this.preparations.resolveSuggestion(suggestionId, 'rejected'))) {
      throw new SuggestionAlreadyResolved(suggestionId);
    }

    const product = await this.products.findById(productId);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    return {
      product,
      isReady: this.isReady(product),
      tokens: await this.preparations.sumTokens(productId),
    };
  }

  async create(input: ProductCreate): Promise<ProductSaving> {
    const { seoKeywords, discardedKeywordsCount } = capKeywords(input.seoKeywords);
    const product = await this.products.create({
      ...input,
      descriptionProm: cleanDescription(input.descriptionProm),
      seoKeywords,
    });

    return { product, isReady: this.isReady(product), discardedKeywordsCount };
  }

  /**
   * A card carried over from a Prom export. It skips the HTTP contract on purpose: the export is
   * trusted input that `db/import-prom.ts` maps itself, and its frames follow through `addImage`.
   */
  async importFromProm(card: ProductDraft & { readonly promId: string }): Promise<Product> {
    return this.products.create(card);
  }

  async findByPromId(promId: string): Promise<Product | null> {
    return this.products.findByPromId(promId);
  }

  async update(id: string, changes: ProductUpdate): Promise<ProductSaving> {
    const { seoKeywords, discardedKeywordsCount } = capKeywords(changes.seoKeywords ?? []);
    const cleaned =
      changes.descriptionProm === undefined
        ? changes
        : { ...changes, descriptionProm: cleanDescription(changes.descriptionProm) };
    // zod leaves an absent `.optional()` field out of the object rather than setting it to
    // `undefined`, so no key here holds `undefined` — its inferred type just cannot say so
    // under `exactOptionalPropertyTypes`.
    const product = await this.products.update(
      id,
      (cleaned.seoKeywords === undefined ? cleaned : { ...cleaned, seoKeywords }) as ProductChanges,
    );
    if (product === null) {
      throw new ProductNotFound(id);
    }

    return { product, isReady: this.isReady(product), discardedKeywordsCount };
  }

  /**
   * The object goes to storage before the row is written: a failed upload leaves no frame without
   * a file. The reverse — a file without a frame — is cleaned up here when the row cannot be written.
   */
  async addImage(productId: string, bytes: Uint8Array): Promise<ProductImage> {
    // Looked up before storage is touched: a card that does not exist would otherwise leave an
    // object behind in R2 and fail on the foreign key only after that.
    const product = await this.products.findById(productId);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    // Spares the upload for a gallery that is plainly full; the repository decides for real.
    if (product.images.length >= productConstraints.maxImagesPerProduct) {
      throw new GalleryFull();
    }

    const key = await this.media.store(bytes, `products/${productId}/${randomUUID()}`);
    let image: ProductImage | null;
    try {
      image = await this.products.addImage(productId, key, productConstraints.maxImagesPerProduct);
    } catch (error) {
      await this.discardObject(key);
      throw error;
    }
    if (image === null) {
      await this.discardObject(key);
      throw new GalleryFull();
    }
    return image;
  }

  /**
   * Best effort: the failure that led here is the one the caller has to hear about, and an object
   * nobody references costs storage, not correctness.
   */
  private async discardObject(key: string): Promise<void> {
    try {
      await this.media.remove(key);
    } catch {
      // Deliberately swallowed — see above.
    }
  }

  /**
   * The object goes before the row (ADR 0012): a failure in between leaves a frame whose object is
   * already gone, and a repeat finishes the job because deleting a missing key succeeds.
   */
  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.products.findImage(productId, imageId);
    if (image === null) {
      throw new ImageNotFound(imageId);
    }

    await this.media.remove(image.r2Key);
    await this.products.deleteImage(imageId);
  }

  /** The objects go before the row (ADR 0012): if storage fails, the card and its frames stay. */
  async deleteProduct(productId: string): Promise<void> {
    const deleted = await this.products.deleteWithObjects(productId, (keys) =>
      this.media.removeMany(keys),
    );
    if (!deleted) {
      throw new ProductNotFound(productId);
    }
  }

  async setMainImage(productId: string, imageId: string): Promise<ProductImage[]> {
    if (!(await this.products.setMainImage(productId, imageId))) {
      throw new ImageNotFound(imageId);
    }
    const product = await this.products.findById(productId);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    return product.images;
  }

  /** The price is a decimal string and never becomes a number: any non-zero digit means above zero. */
  isReady(product: Product): boolean {
    return (
      product.titleProm !== '' &&
      product.titleOlx !== '' &&
      product.descriptionProm !== '' &&
      product.descriptionOlx !== '' &&
      /[1-9]/.test(product.price) &&
      product.images.length > 0
    );
  }
}
