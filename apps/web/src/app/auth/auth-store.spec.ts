import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Session } from '@contracts/auth.contract';
import { AuthStore } from './auth-store';

const SESSION: Session = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
  },
  expiresAt: '2026-09-01T10:00:00.000Z',
};

describe('AuthStore', () => {
  let store: AuthStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('keeps the user after signing in', async () => {
    const pending = store.login({ email: 'admin@example.com', password: 'correct-horse' });

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush(SESSION);

    await pending;
    expect(store.user()).toEqual(SESSION.user);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('forgets the user after signing out', async () => {
    const login = store.login({ email: 'admin@example.com', password: 'correct-horse' });
    http.expectOne('/api/auth/login').flush(SESSION);
    await login;

    const logout = store.logout();
    http.expectOne('/api/auth/logout').flush(null);
    await logout;

    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('forgets the user even when the server did not answer the sign-out', async () => {
    const login = store.login({ email: 'admin@example.com', password: 'correct-horse' });
    http.expectOne('/api/auth/login').flush(SESSION);
    await login;

    const logout = store.logout();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });
    await expect(logout).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(store.user()).toBeNull();
  });

  it('restores the session with a single request even for several concurrent calls', async () => {
    const first = store.restoreSession();
    const second = store.restoreSession();

    http.expectOne('/api/auth/me').flush(SESSION);

    expect(await first).toEqual(SESSION.user);
    expect(await second).toEqual(SESSION.user);

    // A second attempt after a successful check no longer goes anywhere.
    expect(await store.restoreSession()).toEqual(SESSION.user);
    http.verify();
  });

  it('returns null without throwing when there is no session', async () => {
    const pending = store.restoreSession();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await pending).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });
});
