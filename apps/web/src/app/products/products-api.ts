import type { HttpResourceRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  Product,
  ProductCreate,
  ProductImage,
  ProductListQuery,
  ProductUpdate,
  ProductUpdateResponse,
} from '@contracts/products.contract';
import { environment } from '@environments/environment';

/**
 * What is returned is a request, not a subscription: `httpResource` owns the lifecycle and
 * cancels the previous request the moment the query changes, so two pages in flight can no
 * longer resolve out of order and paint the wrong one.
 */
@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly baseUrl = `${environment.apiBaseUrl}/products`;

  listRequest(query: ProductListQuery): HttpResourceRequest {
    return { url: this.baseUrl, params: toParams(query), withCredentials: true };
  }

  getById(productId: string): Observable<Product> {
    throw new Error('Not implemented');
  }

  create(request: ProductCreate): Observable<Product> {
    throw new Error('Not implemented');
  }

  update(productId: string, request: ProductUpdate): Observable<ProductUpdateResponse> {
    throw new Error('Not implemented');
  }

  delete(productId: string): Observable<null> {
    throw new Error('Not implemented');
  }

  uploadImage(productId: string, file: File): Observable<ProductImage> {
    throw new Error('Not implemented');
  }

  setMainImage(productId: string, imageId: string): Observable<ProductImage[]> {
    throw new Error('Not implemented');
  }

  deleteImage(productId: string, imageId: string): Observable<null> {
    throw new Error('Not implemented');
  }
}

/**
 * Every field the query holds becomes a parameter, including fields the contract grows later: a
 * hand-written list of `if`s compiles just as well and silently drops the new filter.
 *
 * A filter that was not set is not sent at all — an empty parameter would arrive as an empty
 * string and be rejected as invalid rather than understood as "no filter".
 */
function toParams(query: ProductListQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  const entries: [string, string | number | boolean | undefined][] = Object.entries(query);
  for (const [key, value] of entries) {
    if (value !== undefined) {
      params[key] = value;
    }
  }
  return params;
}
