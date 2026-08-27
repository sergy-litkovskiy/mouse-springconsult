import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AuthUser, LoginRequest, Session } from '@contracts/auth.contract';
import { AuthApi } from './auth-api';

/**
 * Authentication state of the application. The singleton lives next to the feature it
 * belongs to (`providedIn: 'root'`), not in a separate `core/` directory.
 *
 * An httpOnly cookie cannot be read from JS, so "am I still signed in" after a page
 * reload can be answered in exactly one way — by asking `GET /auth/me`.
 *
 * The whole session is kept, `expiresAt` included: the server names the moment the cookie
 * dies, and a frontend that throws that away has no way to know it is holding a user who
 * is no longer signed in.
 */

/** `setTimeout` stores the delay in a signed 32-bit integer; anything longer fires at once. */
const MAX_TIMEOUT_DELAY = 2_147_483_647;

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly session = signal<Session | null>(null);
  private readonly sessionChecked = signal(false);
  /** Several guards on one navigation must not fire several identical requests. */
  private restoring: Promise<AuthUser | null> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly expiresAt = computed(() => this.session()?.expiresAt ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.cancelExpiry();
    });
  }

  async login(request: LoginRequest): Promise<AuthUser> {
    const session = await firstValueFrom(this.api.login(request));
    this.acceptSession(session);
    return session.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      // Even if the server did not answer, locally the session is gone.
      this.clearSession();
    }
  }

  /**
   * Drops the session without asking the server — for the two cases where the answer is
   * already known: a sign-out, and a 401 on any other call.
   */
  clearSession(): void {
    this.cancelExpiry();
    this.session.set(null);
    this.sessionChecked.set(true);
    this.restoring = null;
  }

  async restoreSession(): Promise<AuthUser | null> {
    if (this.hasExpired()) {
      this.clearSession();
    }
    if (this.sessionChecked()) {
      return this.user();
    }
    this.restoring ??= this.fetchSession();
    return this.restoring;
  }

  private async fetchSession(): Promise<AuthUser | null> {
    try {
      this.acceptSession(await firstValueFrom(this.api.currentSession()));
    } catch {
      this.cancelExpiry();
      this.session.set(null);
    } finally {
      this.sessionChecked.set(true);
      this.restoring = null;
    }
    return this.user();
  }

  private acceptSession(session: Session): void {
    this.session.set(session);
    this.sessionChecked.set(true);
    this.scheduleExpiry(session.expiresAt);
  }

  /**
   * The timer is what makes `isAuthenticated()` tell the truth without polling. It cannot
   * cover everything — a sleeping machine, or a TTL longer than `setTimeout` can hold — so
   * `restoreSession()` checks the clock as well.
   */
  private scheduleExpiry(expiresAt: string): void {
    this.cancelExpiry();
    const delay = Date.parse(expiresAt) - Date.now();
    if (Number.isNaN(delay) || delay > MAX_TIMEOUT_DELAY) {
      return;
    }
    this.expiryTimer = setTimeout(
      () => {
        this.clearSession();
      },
      Math.max(delay, 0),
    );
  }

  private cancelExpiry(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private hasExpired(): boolean {
    const session = this.session();
    if (session === null) {
      return false;
    }
    const expiresAt = Date.parse(session.expiresAt);
    return !Number.isNaN(expiresAt) && expiresAt <= Date.now();
  }
}
