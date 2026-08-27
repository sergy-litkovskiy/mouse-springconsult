import { computed, inject, Injectable, signal } from '@angular/core';
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
 * dies, and a store that throws that away answers the guards' question with a session it
 * has no reason to believe in. There is no timer on that moment — a "remember me" cookie
 * outlives what `setTimeout` can hold, and a session that dies unnoticed in an open tab is
 * caught by the very next request through `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly session = signal<Session | null>(null);
  private readonly sessionChecked = signal(false);
  /** Several guards on one navigation must not fire several identical requests. */
  private restoring: Promise<AuthUser | null> | null = null;
  /**
   * Bumped by everything that decides the session is gone. An answer to `GET /auth/me` that
   * lands after a sign-out describes a session nobody has any more, and writing it back
   * would sign the admin in again with a cookie the server has already forgotten.
   */
  private generation = 0;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  async login(request: LoginRequest): Promise<AuthUser> {
    const session = await firstValueFrom(this.api.login(request));
    this.generation += 1;
    this.session.set(session);
    this.sessionChecked.set(true);
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
    this.generation += 1;
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
    const generation = this.generation;
    try {
      const session = await firstValueFrom(this.api.currentSession());
      if (generation === this.generation) {
        this.session.set(session);
      }
    } catch {
      if (generation === this.generation) {
        this.session.set(null);
      }
    } finally {
      if (generation === this.generation) {
        this.sessionChecked.set(true);
        this.restoring = null;
      }
    }
    return this.user();
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
