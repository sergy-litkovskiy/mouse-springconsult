import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth-interceptor';
import { AuthStore } from './auth-store';

const SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
  },
  expiresAt: '2026-09-01T10:00:00.000Z',
};

/** Somewhere for the router to be, so that `router.url` is a real page and not the root. */
@Component({ template: '' })
class Somewhere {}

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let store: AuthStore;
  let router: Router;

  async function signIn(): Promise<void> {
    const pending = store.login({ email: 'admin@example.com', password: 'correct-horse' });
    http.expectOne('/api/auth/login').flush(SESSION);
    await pending;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'products', component: Somewhere }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
  });

  it('clears the session and returns to the form when a request comes back 401', async () => {
    await signIn();
    await router.navigateByUrl('/products?page=2');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const pending = firstValueFrom(client.get('/api/products'));
    http.expectOne('/api/products').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/products?page=2' },
    });
  });

  it('leaves the auth endpoints alone — a wrong password is not a lost session', async () => {
    await signIn();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const pending = firstValueFrom(client.post('/api/auth/login', {}));
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.user()).toEqual(SESSION.user);
    expect(navigate).not.toHaveBeenCalled();
  });
});
