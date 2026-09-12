import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { type ConfirmDialogData, ConfirmDialog } from './confirm-dialog';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const DELETE_URL = `/api/products/${PRODUCT_ID}`;

const QUESTION: ConfirmDialogData = {
  title: 'Видалити картку?',
  message: 'Картку й усі її фото буде видалено остаточно.',
  confirmLabel: 'Видалити',
};

describe('ConfirmDialog', () => {
  let dialog: MatDialog;
  let http: HttpTestingController;
  let closedWith: boolean | undefined;
  let closed: boolean;

  /**
   * Opens the dialog the way T21 and T22 will: the irreversible request is wired to the
   * result, so whether it goes out depends on nothing but the admin's answer.
   */
  async function askBeforeDeleting(): Promise<void> {
    closed = false;
    closedWith = undefined;
    const ref = dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: QUESTION,
    });
    ref.afterClosed().subscribe((result) => {
      closed = true;
      closedWith = result;
      if (result === true) {
        TestBed.inject(HttpClient).delete(DELETE_URL).subscribe();
      }
    });
    await settle();
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /** The dialog lives in the overlay container on the body, not inside any fixture. */
  function surface(): HTMLElement | null {
    return document.querySelector<HTMLElement>('mat-dialog-container');
  }

  function button(label: string): HTMLButtonElement | undefined {
    const buttons = surface()?.querySelectorAll<HTMLButtonElement>('button') ?? [];
    return [...buttons].find((candidate) => candidate.textContent.trim() === label);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // afterClosed() fires only once the exit animation is over; settle() does not wait it out.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    dialog = TestBed.inject(MatDialog);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    dialog.closeAll();
    await settle();
    http.verify();
  });

  it('puts the caller question and both answers in Ukrainian in front of the admin', async () => {
    await askBeforeDeleting();

    expect(surface()?.textContent).toContain('Видалити картку?');
    expect(surface()?.textContent).toContain('Картку й усі її фото буде видалено остаточно.');
    expect(button('Видалити')).toBeDefined();
    expect(button('Скасувати')).toBeDefined();
  });

  it('holds the request back until the admin confirms and sends it after (AC-18)', async () => {
    await askBeforeDeleting();

    http.expectNone(DELETE_URL);

    const confirm = button('Видалити');
    expect(confirm).toBeDefined();
    confirm?.click();
    await settle();

    expect(closed).toBe(true);
    expect(closedWith).toBe(true);
    const request = http.expectOne(DELETE_URL);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('closes without sending anything when the admin cancels (SPEC AC)', async () => {
    await askBeforeDeleting();

    const cancel = button('Скасувати');
    expect(cancel).toBeDefined();
    cancel?.click();
    await settle();

    expect(closed).toBe(true);
    expect(closedWith).toBe(false);
    http.expectNone(DELETE_URL);
  });
});
