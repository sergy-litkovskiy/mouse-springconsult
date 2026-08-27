import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ProductList, ProductListQuery } from '@contracts/products.contract';
import { environment } from '@environments/environment';

/**
 * HTTP transport of the catalogue. Query and response types come from `@contracts` —
 * the very zod schemas the backend validates the request with.
 *
 * A filter that was not set is not sent: an empty parameter would arrive as an empty
 * string and be rejected as invalid rather than understood as "no filter".
 */
@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/products`;

  list(query: ProductListQuery): Observable<ProductList> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sort', query.sort)
      .set('direction', query.direction);

    if (query.title !== undefined) {
      params = params.set('title', query.title);
    }
    if (query.description !== undefined) {
      params = params.set('description', query.description);
    }
    if (query.priceMin !== undefined) {
      params = params.set('priceMin', query.priceMin);
    }
    if (query.priceMax !== undefined) {
      params = params.set('priceMax', query.priceMax);
    }
    if (query.category !== undefined) {
      params = params.set('category', query.category);
    }
    if (query.published !== undefined) {
      params = params.set('published', query.published);
    }
    if (query.accountProm !== undefined) {
      params = params.set('accountProm', query.accountProm);
    }
    if (query.accountOlx !== undefined) {
      params = params.set('accountOlx', query.accountOlx);
    }

    return this.http.get<ProductList>(this.baseUrl, { params, withCredentials: true });
  }
}
