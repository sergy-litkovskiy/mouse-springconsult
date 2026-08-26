import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { LoginRequest, Session } from '@contracts/auth.contract';
import { environment } from '@environments/environment';

/**
 * HTTP transport of authentication. Request and response types come from `@contracts` —
 * the very zod schemas the backend validates incoming data with.
 *
 * The session travels in an httpOnly cookie, so the token is neither stored nor read here:
 * JavaScript simply cannot see it. `withCredentials` is set explicitly even though the
 * origin is the same — so that changing `apiBaseUrl` cannot break auth silently.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  login(request: LoginRequest): Observable<Session> {
    return this.http.post<Session>(`${this.baseUrl}/login`, request, { withCredentials: true });
  }

  /** The server answers 204 with no body, so HttpClient yields exactly `null` here. */
  logout(): Observable<null> {
    return this.http.post<null>(`${this.baseUrl}/logout`, {}, { withCredentials: true });
  }

  currentSession(): Observable<Session> {
    return this.http.get<Session>(`${this.baseUrl}/me`, { withCredentials: true });
  }
}
