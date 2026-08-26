import type { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Вхід — mouse',
    loadComponent: async () => (await import('./auth/login-page')).LoginPage,
  },
  {
    path: 'products',
    title: 'Каталог товарів — mouse',
    canActivate: [authGuard],
    loadComponent: async () => (await import('./products/product-catalog')).ProductCatalog,
  },
  {
    path: 'welcome',
    title: 'Вітаємо — mouse',
    canActivate: [authGuard],
    loadComponent: async () => (await import('./welcome')).Welcome,
  },
  { path: '**', redirectTo: 'login' },
];
