import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { AuthStore } from './auth-store';

/**
 * Lets a request onto a protected route only when a session exists. The check is done by
 * the server: the frontend has no access to the httpOnly cookie and cannot judge on its own.
 */
export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const user = await store.restoreSession();
  return user !== null ? true : router.createUrlTree(['/login']);
};
