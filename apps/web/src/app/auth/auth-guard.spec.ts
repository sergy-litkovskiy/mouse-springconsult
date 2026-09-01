import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard } from './auth-guard';

const SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
  },
  // An hour ahead of the run: a fixed moment expires the session the day it names.
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

describe('authGuard', () => {
  let http: HttpTestingController;

  function activate(url: string): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lets a route through when a session exists', async () => {
    const result = activate('/products');

    http.expectOne('/api/auth/me').flush(SESSION);

    expect(await result).toBe(true);
  });

  it('redirects to /login and remembers where the admin was heading', async () => {
    const result = activate('/products?page=3');

    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const resolved = await result;
    expect(resolved).toBeInstanceOf(UrlTree);
    expect(String(resolved)).toBe('/login?returnUrl=%2Fproducts%3Fpage%3D3');
  });

  it('adds no returnUrl for the root, which is not a destination worth returning to', async () => {
    const result = activate('/');

    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(String(await result)).toBe('/login');
  });
});
