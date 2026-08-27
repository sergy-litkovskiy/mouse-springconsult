import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { returnUrlTree } from '../safe-return-url';
import { AuthStore } from './auth-store';

/**
 * The mirror image of `authGuard`: the sign-in form is for those who are not signed in.
 * Without it an admin who opens a bookmark of the site root is shown a login form and retypes
 * credentials the browser was already sending in a live cookie.
 */
export const guestGuard: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const user = await store.restoreSession();
  return user === null ? true : returnUrlTree(router, route.queryParamMap.get('returnUrl'));
};
