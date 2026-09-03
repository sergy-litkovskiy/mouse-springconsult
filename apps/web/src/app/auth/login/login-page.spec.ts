import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ApiError } from '@contracts/error.contract';
import { LoginPage } from './login-page';

const SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
  },
  // An hour ahead of the run: a fixed moment expires the session the day it names.
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const INVALID_CREDENTIALS: ApiError = {
  error: { code: 'invalid_credentials', message: 'Email or password is incorrect' },
};

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let http: HttpTestingController;
  let element: HTMLElement;

  /** Filled through the DOM, not through the instance: the test must see what the user sees. */
  function type(selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector);
    if (input === null) {
      throw new Error(`no input matching ${selector}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function fill(email: string, password: string, rememberMe = false): void {
    type('input[formcontrolname="email"]', email);
    type('input[formcontrolname="password"]', password);
    if (rememberMe) {
      element.querySelector<HTMLInputElement>('mat-checkbox input')?.click();
    }
  }

  function submit(): void {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
  }

  /**
   * The sign-in handler is asynchronous, so a single whenStable() is not enough: the
   * microtask queue has to drain first, and only then can the DOM be inspected.
   */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(LoginPage);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('renders the sign-in form in Ukrainian', () => {
    expect(element.textContent).toContain('Вхід в адмінку');
    expect(element.querySelector('input[formcontrolname="email"]')).not.toBeNull();
    expect(element.querySelector('input[formcontrolname="password"]')).not.toBeNull();
    expect(element.textContent).toContain('Запам’ятати мене');
  });

  it('sends no request while the form is invalid', async () => {
    fill('not-an-email', 'short');
    submit();
    await settle();

    http.verify();
    expect(element.textContent).toContain('Схоже, це не email');
  });

  it('opens the catalogue after a successful sign-in', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fill('admin@example.com', 'correct-horse', true);
    submit();
    await settle();

    const request = http.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({
      email: 'admin@example.com',
      password: 'correct-horse',
      rememberMe: true,
    });
    request.flush(SESSION);
    await settle();

    expect(String(navigate.mock.lastCall?.[0])).toBe('/products');
  });

  it('returns to the page the guard interrupted', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentRef.setInput('returnUrl', '/products?page=3');

    fill('admin@example.com', 'correct-horse');
    submit();
    await settle();

    http.expectOne('/api/auth/login').flush(SESSION);
    await settle();

    expect(String(navigate.mock.lastCall?.[0])).toBe('/products?page=3');
  });

  it('refuses a returnUrl that points outside the application', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentRef.setInput('returnUrl', 'https://evil.example/phish');

    fill('admin@example.com', 'correct-horse');
    submit();
    await settle();

    http.expectOne('/api/auth/login').flush(SESSION);
    await settle();

    expect(String(navigate.mock.lastCall?.[0])).toBe('/products');
  });

  it('highlights both fields and shows a message on wrong credentials', async () => {
    fill('admin@example.com', 'wrong-password');
    submit();
    await settle();

    http
      .expectOne('/api/auth/login')
      .flush(INVALID_CREDENTIALS, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Невірний email або пароль',
    );
    expect(element.querySelectorAll('mat-form-field.mat-form-field-invalid').length).toBe(2);
  });

  it('explains the reason when the attempt limit is exceeded', async () => {
    fill('admin@example.com', 'correct-horse');
    submit();
    await settle();

    http
      .expectOne('/api/auth/login')
      .flush(
        { error: { code: 'too_many_requests', message: 'Too many requests' } } satisfies ApiError,
        { status: 429, statusText: 'Too Many Requests' },
      );
    await settle();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Забагато спроб входу');
  });

  it('clears the server error as soon as the user edits the input', async () => {
    fill('admin@example.com', 'wrong-password');
    submit();
    await settle();

    http
      .expectOne('/api/auth/login')
      .flush(INVALID_CREDENTIALS, { status: 401, statusText: 'Unauthorized' });
    await settle();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();

    fill('admin@example.com', 'another-attempt');
    await settle();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll('mat-form-field.mat-form-field-invalid').length).toBe(0);
  });
});
