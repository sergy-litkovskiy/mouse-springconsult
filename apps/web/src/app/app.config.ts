import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './auth/auth-interceptor';

/**
 * `withFetch()` is absent on purpose: since v22 fetch is the backend `provideHttpClient()`
 * installs by default, and `withXhr()` is the opt-out.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
