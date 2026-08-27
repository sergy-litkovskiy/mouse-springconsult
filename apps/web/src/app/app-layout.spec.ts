import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppLayout } from './app-layout';
import { AuthStore } from './auth/auth-store';

const SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
  },
  expiresAt: '2026-09-01T10:00:00.000Z',
};

describe('AppLayout', () => {
  let fixture: ComponentFixture<AppLayout>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let router: Router;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function signIn(): Promise<void> {
    const store = TestBed.inject(AuthStore);
    const pending = store.login({ email: 'admin@example.com', password: 'correct-horse' });
    http.expectOne('/api/auth/login').flush(SESSION);
    await pending;
    await settle();
  }

  function clickLogout(): void {
    element.querySelector<HTMLButtonElement>('mat-toolbar button')?.click();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AppLayout);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('names the admin who is signed in', async () => {
    await signIn();

    expect(element.textContent).toContain('Адміністратор');
  });

  it('signs out and leaves for the form', async () => {
    await signIn();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    clickLogout();
    await settle();
    http.expectOne('/api/auth/logout').flush(null);
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('leaves for the form even when the server refuses the sign-out', async () => {
    await signIn();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    clickLogout();
    await settle();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    // The session is gone locally, so staying on a page that requires one is not an option.
    expect(TestBed.inject(AuthStore).user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
