import type { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';
import { guestGuard } from './auth/guest-guard';

/**
 * Two areas, and which one a URL belongs to is decided by a guard rather than by a fixed
 * redirect: everything under the layout requires a session, the sign-in form requires the
 * absence of one. The root and anything unrecognised go through the same check, so an admin
 * with a live cookie is never shown a login form for the sake of a bookmark.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Вхід — mouse',
    canActivate: [guestGuard],
    loadComponent: async () => (await import('./auth/login-page')).LoginPage,
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: async () => (await import('./app-layout')).AppLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'products' },
      {
        path: 'products',
        title: 'Каталог товарів — mouse',
        loadComponent: async () => (await import('./products/product-catalog')).ProductCatalog,
      },
      { path: '**', redirectTo: 'products' },
    ],
  },
];
