import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { guestGuard } from './guest-guard';

const SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
  },
  // An hour ahead of the run: a fixed moment expires the session the day it names.
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

describe('guestGuard', () => {
  let http: HttpTestingController;

  function activate(returnUrl?: string): Promise<boolean | UrlTree> {
    const queryParamMap = convertToParamMap(returnUrl === undefined ? {} : { returnUrl });
    return TestBed.runInInjectionContext(() =>
      guestGuard({ queryParamMap } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
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

  it('shows the form to someone who is not signed in', async () => {
    const result = activate();

    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await result).toBe(true);
  });

  it('sends a signed-in admin on to where they were heading', async () => {
    const result = activate('/products?page=2');

    http.expectOne('/api/auth/me').flush(SESSION);

    expect(String(await result)).toBe('/products?page=2');
  });

  it('falls back to the catalogue when the returnUrl cannot be parsed', async () => {
    // A lone `%` is a path decodeURIComponent throws on — from inside a guard that would
    // fail the navigation outright and leave the admin on a blank page.
    const result = activate('/products?q=100%');

    http.expectOne('/api/auth/me').flush(SESSION);

    expect(String(await result)).toBe('/products');
  });

  it('refuses a returnUrl pointing outside the application', async () => {
    const result = activate('//evil.example/phish');

    http.expectOne('/api/auth/me').flush(SESSION);

    expect(String(await result)).toBe('/products');
  });
});
