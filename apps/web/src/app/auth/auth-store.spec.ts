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
  // An hour ahead of the run rather than a fixed date. `hasExpired` compares this with
  // `Date.now()`, so a hardcoded moment is a bomb: the suite passes until that day and
  // fails from it on.
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

/** The same session, but the server said it died before this test started. */
const EXPIRED_SESSION: Session = { ...SESSION, expiresAt: '2020-01-01T00:00:00.000Z' };

describe('AuthStore', () => {
  let store: AuthStore;
  let http: HttpTestingController;

  async function signIn(session: Session = SESSION): Promise<void> {
    const pending = store.login({ email: 'admin@example.com', password: 'correct-horse' });
    http.expectOne('/api/auth/login').flush(session);
    await pending;
  }

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
    await signIn();

    expect(store.user()).toEqual(SESSION.user);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('forgets the user after signing out', async () => {
    await signIn();

    const logout = store.logout();
    http.expectOne('/api/auth/logout').flush(null);
    await logout;

    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('forgets the user even when the server did not answer the sign-out', async () => {
    await signIn();

    const logout = store.logout();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });
    await expect(logout).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(store.user()).toBeNull();
  });

  it('forgets the session on demand without asking the server', async () => {
    await signIn();

    store.clearSession();

    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    // A 401 already answered the question, so there is nothing left to ask.
    expect(await store.restoreSession()).toBeNull();
  });

  it('reports no session once the moment the server named has passed', async () => {
    await signIn(EXPIRED_SESSION);

    expect(await store.restoreSession()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('does not let a session check that was overtaken by a sign-out write itself back', async () => {
    const restoring = store.restoreSession();
    const probe = http.expectOne('/api/auth/me');

    // The admin signs out while the check is still in flight.
    store.clearSession();
    probe.flush(SESSION);

    expect(await restoring).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
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
