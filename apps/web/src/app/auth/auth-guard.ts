import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { isWorthReturningTo } from '../safe-return-url';
import { AuthStore } from './auth-store';

/**
 * Whether a session exists is the server's answer: the frontend has no access to the httpOnly
 * cookie and cannot judge on its own. The URL that was asked for travels to the sign-in form as
 * `returnUrl`, so a bookmark on a deep page survives the detour through login.
 */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const user = await store.restoreSession();
  if (user !== null) {
    return true;
  }

  const target = state.url;
  return router.createUrlTree(
    ['/login'],
    isWorthReturningTo(target) ? { queryParams: { returnUrl: target } } : {},
  );
};
