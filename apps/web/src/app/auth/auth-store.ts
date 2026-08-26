import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AuthUser, LoginRequest } from '@contracts/auth.contract';
import { AuthApi } from './auth-api';

/**
 * Authentication state of the application. The singleton lives next to the feature it
 * belongs to (`providedIn: 'root'`), not in a separate `core/` directory.
 *
 * An httpOnly cookie cannot be read from JS, so "am I still signed in" after a page
 * reload can be answered in exactly one way — by asking `GET /auth/me`.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly currentUser = signal<AuthUser | null>(null);
  private readonly sessionChecked = signal(false);
  /** Several guards on one navigation must not fire several identical requests. */
  private restoring: Promise<AuthUser | null> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  async login(request: LoginRequest): Promise<AuthUser> {
    const session = await firstValueFrom(this.api.login(request));
    this.currentUser.set(session.user);
    this.sessionChecked.set(true);
    return session.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      // Even if the server did not answer, locally the session is gone.
      this.currentUser.set(null);
      this.sessionChecked.set(true);
      this.restoring = null;
    }
  }

  async restoreSession(): Promise<AuthUser | null> {
    if (this.sessionChecked()) {
      return this.currentUser();
    }
    this.restoring ??= this.fetchSession();
    return this.restoring;
  }

  private async fetchSession(): Promise<AuthUser | null> {
    try {
      const session = await firstValueFrom(this.api.currentSession());
      this.currentUser.set(session.user);
    } catch {
      this.currentUser.set(null);
    } finally {
      this.sessionChecked.set(true);
      this.restoring = null;
    }
    return this.currentUser();
  }
}
