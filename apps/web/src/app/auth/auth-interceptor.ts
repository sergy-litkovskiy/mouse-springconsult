import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthStore } from './auth-store';

/**
 * A 401 says the session is gone, and that is a fact about the whole application — not a
 * detail of whichever page happened to make the request. Handled page by page it produces a
 * deadlock: the table shows "sign in again" while the store still holds the stale user, so
 * every guard keeps letting the navigation through and every request keeps failing.
 *
 * The `auth` endpoints are the exception, and each for its own reason: `login` answers 401 for
 * a wrong password, `me` answers 401 to mean "no session — which is what it was asked", and
 * `logout` has nothing left to invalidate.
 */
const authEndpointPrefix = `${environment.apiBaseUrl}/auth/`;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (isSessionLost(error) && !request.url.startsWith(authEndpointPrefix)) {
        store.clearSession();
        void router.navigate(['/login'], returnTo(router.url));
      }
      return throwError(() => error);
    }),
  );
};

function isSessionLost(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 401;
}

/** Where the admin was when the session died — worth coming back to, unless it was the form. */
function returnTo(url: string): { queryParams?: { returnUrl: string } } {
  return url === '/' || url.startsWith('/login') ? {} : { queryParams: { returnUrl: url } };
}
