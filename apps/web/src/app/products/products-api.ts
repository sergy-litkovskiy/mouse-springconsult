import { HttpClient, type HttpResourceRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { PreparationRunDto, PreparationRunRequest } from '@contracts/ai.contract';
import type {
  Product,
  ProductCardRead,
  ProductCreateRequest,
  ProductImage,
  ProductListQuery,
  ProductUpdate,
  ProductUpdateResponse,
} from '@contracts/products.contract';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/products`;

  /**
   * What is returned is a request, not a subscription: `httpResource` owns the lifecycle and
   * cancels the previous request the moment the query changes, so two pages in flight can no
   * longer resolve out of order and paint the wrong one.
   */
  listRequest(query: ProductListQuery): HttpResourceRequest {
    return { url: this.baseUrl, params: toParams(query), withCredentials: true };
  }

  getById(productId: string): Observable<ProductCardRead> {
    return this.http.get<ProductCardRead>(`${this.baseUrl}/${productId}`, {
      withCredentials: true,
    });
  }

  create(request: ProductCreateRequest): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, request, { withCredentials: true });
  }

  update(productId: string, request: ProductUpdate): Observable<ProductUpdateResponse> {
    return this.http.patch<ProductUpdateResponse>(`${this.baseUrl}/${productId}`, request, {
      withCredentials: true,
    });
  }

  delete(productId: string): Observable<null> {
    return this.http.delete<null>(`${this.baseUrl}/${productId}`, { withCredentials: true });
  }

  uploadImage(productId: string, file: File): Observable<ProductImage> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ProductImage>(`${this.baseUrl}/${productId}/images`, body, {
      withCredentials: true,
    });
  }

  setMainImage(productId: string, imageId: string): Observable<ProductImage[]> {
    return this.http.put<ProductImage[]>(
      `${this.baseUrl}/${productId}/images/${imageId}/main`,
      null,
      { withCredentials: true },
    );
  }

  deleteImage(productId: string, imageId: string): Observable<null> {
    return this.http.delete<null>(`${this.baseUrl}/${productId}/images/${imageId}`, {
      withCredentials: true,
    });
  }

  startPreparationRun(
    productId: string,
    request: PreparationRunRequest,
  ): Observable<PreparationRunDto> {
    return this.http.post<PreparationRunDto>(
      `${this.baseUrl}/${productId}/preparation-runs`,
      request,
      { withCredentials: true },
    );
  }

  /** A request for `httpResource`, like the list: the dialog that shows it owns the lifecycle. */
  failedRunsRequest(productId: string): HttpResourceRequest {
    return {
      url: `${this.baseUrl}/${productId}/preparation-runs`,
      params: { status: 'failed' },
      withCredentials: true,
    };
  }

  getPreparationRun(productId: string, runId: string): Observable<PreparationRunDto> {
    return this.http.get<PreparationRunDto>(
      `${this.baseUrl}/${productId}/preparation-runs/${runId}`,
      { withCredentials: true },
    );
  }

  acceptSuggestion(productId: string, suggestionId: string): Observable<ProductCardRead> {
    return this.http.post<ProductCardRead>(
      `${this.baseUrl}/${productId}/suggestions/${suggestionId}/accept`,
      null,
      { withCredentials: true },
    );
  }

  rejectSuggestion(productId: string, suggestionId: string): Observable<ProductCardRead> {
    return this.http.post<ProductCardRead>(
      `${this.baseUrl}/${productId}/suggestions/${suggestionId}/reject`,
      null,
      { withCredentials: true },
    );
  }
}

type QueryParamValue = string | number | boolean | readonly string[];

/**
 * Every field the query holds becomes a parameter, including fields the contract grows later: a
 * hand-written list of `if`s compiles just as well and silently drops the new filter.
 *
 * A filter that was not set is not sent at all — an empty parameter would arrive as an empty
 * string and be rejected as invalid rather than understood as "no filter".
 */
function toParams(query: ProductListQuery): Record<string, QueryParamValue> {
  const params: Record<string, QueryParamValue> = {};
  const entries: [string, QueryParamValue | undefined][] = Object.entries(query);
  for (const [key, value] of entries) {
    if (value !== undefined) {
      params[key] = value;
    }
  }
  return params;
}
