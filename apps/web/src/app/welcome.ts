import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { AuthStore } from './auth/auth-store';

/**
 * Temporary page shown after signing in. It lives as a file at the `app/` level rather
 * than in its own directory: once the product catalogue lands, it goes away with this file.
 */
@Component({
  selector: 'app-welcome',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatToolbarModule],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Welcome {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly leaving = signal(false);

  protected async logout(): Promise<void> {
    if (this.leaving()) {
      return;
    }
    this.leaving.set(true);
    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } finally {
      this.leaving.set(false);
    }
  }
}
