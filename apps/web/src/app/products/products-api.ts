import type { HttpResourceRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { ProductListQuery } from '@contracts/products.contract';
import { environment } from '@environments/environment';

/**
 * HTTP transport of the catalogue. The query type comes from `@contracts` — the very zod
 * schema the backend validates the request with.
 *
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
}

/**
 * Every field the query actually holds becomes a parameter, including fields the contract
 * grows later. A hand-written list of `if`s compiles just as well and silently drops the new
 * filter: the admin sets it, the table ignores it, and nothing fails anywhere.
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
