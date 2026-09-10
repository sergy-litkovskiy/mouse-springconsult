import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStore } from './auth/auth-store';

/**
 * A file at the `app/` level and not inside a feature, because the shell is the one place allowed
 * to know about both — the catalogue must not reach into `auth` for a sign-out button.
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
   * Ends on the login page whatever the server said: `AuthStore.logout()` clears the session
   * locally and then re-throws, and letting that rejection past would leave the admin on a page
   * whose data is gone, with no message and no way back.
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
