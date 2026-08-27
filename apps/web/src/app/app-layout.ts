import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStore } from './auth/auth-store';

/**
 * The shell of the signed-in half of the application: a toolbar that says who is here and
 * lets them leave, plus the outlet its child routes render into. It lives as a file at the
 * `app/` level and not inside a feature, because it is the one place allowed to know about
 * both — the catalogue must not reach into `auth` for a sign-out button.
 *
 * It replaces the temporary welcome page, which had become an interstitial between the sign-in
 * form and the catalogue the admin actually asked for.
 */
@Component({
  selector: 'app-layout',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, RouterOutlet],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly leaving = signal(false);

  /**
   * Signing out ends on the login page whatever the server said. `AuthStore.logout()` clears
   * the session locally and then re-throws, and letting that rejection past here would leave
   * the admin on a page whose data is gone, with no message and no way back.
   */
  protected async logout(): Promise<void> {
    if (this.leaving()) {
      return;
    }
    this.leaving.set(true);
    try {
      await this.auth.logout();
    } catch {
      // The server did not confirm it, but the session is gone locally either way.
    }
    await this.router.navigate(['/login']);
    this.leaving.set(false);
  }
}
