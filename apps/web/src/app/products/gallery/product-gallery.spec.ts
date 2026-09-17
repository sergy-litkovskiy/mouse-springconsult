import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { type Observable, of } from 'rxjs';
import type { ApiError } from '@contracts/error.contract';
import type { ProductImage } from '@contracts/products.contract';
import { ProductGallery } from './product-gallery';

const CARD_ID = '11111111-1111-4111-8111-111111111111';
const IMAGES_URL = `/api/products/${CARD_ID}/images`;

function frame(index: number, isMain = false): ProductImage {
  const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`;
  return {
    id,
    r2Key: `products/${CARD_ID}/${id}.jpg`,
    url: `https://r2.example.com/products/${CARD_ID}/${id}.jpg`,
    position: index,
    isMain,
  };
}

function file(name: string, type = 'image/jpeg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function failure(code: string, message = 'refused'): ApiError {
  return { error: { code, message } };
}

/** Stands in for the card form: it owns the frames and feeds every change back in. */
@Component({
  selector: 'app-gallery-host',
  imports: [ProductGallery],
  template: `
    <app-product-gallery
      [images]="images()"
      [ensureProduct]="ensureProduct"
      (imagesChange)="changed($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class GalleryHost {
  readonly images = signal<readonly ProductImage[]>([]);
  readonly reported: (readonly ProductImage[])[] = [];
  ensureCalls = 0;
  readonly ensureProduct = (): Observable<string> => {
    this.ensureCalls += 1;
    return of(CARD_ID);
  };

  changed(images: readonly ProductImage[]): void {
    this.reported.push(images);
    this.images.set(images);
  }
}

describe('ProductGallery', () => {
  let fixture: ComponentFixture<GalleryHost>;
  let host: GalleryHost;
  let http: HttpTestingController;
  let element: HTMLElement;

  async function open(images: readonly ProductImage[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [GalleryHost],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // afterClosed() fires only once the exit animation is over; settle() does not wait it out.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(GalleryHost);
    host = fixture.componentInstance;
    host.images.set(images);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    await settle();
  }

  /** The handlers are asynchronous: drain the microtask queue before reading the DOM. */
  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function pick(...files: File[]): void {
    const picker = element.querySelector<HTMLInputElement>('[data-testid="frame-picker"]');
    if (picker === null) {
      throw new Error('no file picker');
    }
    const list = Object.assign([...files], { item: (index: number) => files[index] ?? null });
    Object.defineProperty(picker, 'files', { value: list, configurable: true });
    picker.dispatchEvent(new Event('change'));
  }

  function count(testId: string): number {
    return element.querySelectorAll(`[data-testid="${testId}"]`).length;
  }

  function button(label: string, root: ParentNode = element): HTMLButtonElement {
    const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label || candidate.textContent.trim() === label,
    );
    if (found === undefined) {
      throw new Error(`no button «${label}»`);
    }
    return found;
  }

  /** The confirmation lives in the overlay container on the body, not inside the fixture. */
  async function answerConfirmation(label: 'Видалити' | 'Скасувати'): Promise<void> {
    const surface = document.querySelector('mat-dialog-container');
    if (surface === null) {
      throw new Error('no confirmation open');
    }
    button(label, surface).click();
    await settle();
  }

  beforeEach(() => {
    let next = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${String(next++)}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    TestBed.inject(MatDialog).closeAll();
    await settle();
    http.verify();
    vi.restoreAllMocks();
  });

  describe('uploading (AC-01, QG-2)', () => {
    it('draws the chosen file before the server answers', async () => {
      await open([]);

      pick(file('front.jpg'));
      await settle();

      const request = http.expectOne(IMAGES_URL);
      const preview = element.querySelector<HTMLImageElement>('[data-testid="pending-frame"] img');
      expect(preview?.getAttribute('src')).toBe('blob:preview-0');
      expect(count('frame')).toBe(0);

      request.flush(frame(0, true));
      await settle();

      expect(count('pending-frame')).toBe(0);
      expect(count('frame')).toBe(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-0');
    });

    it('asks the form for the card before the first upload and sends the file as multipart', async () => {
      await open([]);

      pick(file('front.jpg'));
      await settle();

      expect(host.ensureCalls).toBe(1);
      const request = http.expectOne(IMAGES_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBeInstanceOf(FormData);
      request.flush(frame(0, true));
      await settle();
    });

    it('shows the first frame as the main one, the way the server returned it (AC-19)', async () => {
      await open([]);

      pick(file('front.jpg'));
      await settle();
      http.expectOne(IMAGES_URL).flush(frame(0, true));
      await settle();

      expect(element.textContent).toContain('Головне');
      expect(host.reported.at(-1)).toEqual([frame(0, true)]);
    });

    it('uploads several files one after another, in the order chosen', async () => {
      await open([]);

      pick(file('one.jpg'), file('two.jpg'));
      await settle();

      expect(count('pending-frame')).toBe(2);
      http.expectOne(IMAGES_URL).flush(frame(0, true));
      await settle();
      http.expectOne(IMAGES_URL).flush(frame(1));
      await settle();

      expect(count('frame')).toBe(2);
      expect(host.images()).toEqual([frame(0, true), frame(1)]);
    });
  });

  describe('refusing before the upload', () => {
    it('refuses a file over 10 MB without sending it', async () => {
      await open([]);

      pick(file('huge.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1));
      await settle();

      http.expectNone(IMAGES_URL);
      expect(element.textContent).toContain('«huge.jpg» більший за 10 МБ.');
    });

    it('refuses a file that is not an image without sending it', async () => {
      await open([]);

      pick(file('notes.pdf', 'application/pdf'));
      await settle();

      http.expectNone(IMAGES_URL);
      expect(element.textContent).toContain('«notes.pdf» не є зображенням JPEG, PNG чи WebP.');
    });
  });

  describe('a full gallery (AC-02)', () => {
    it('offers no way to add an eleventh frame and names the reason', async () => {
      await open(Array.from({ length: 10 }, (_, index) => frame(index, index === 0)));

      expect(element.querySelector('[data-testid="frame-picker"]')).toBeNull();
      expect(element.querySelector('[data-testid="frame-count"]')?.textContent).toContain(
        '10 з 10',
      );
      expect(element.textContent).toContain('Галерея вміщає щонайбільше десять кадрів.');
    });

    it('sends only what still fits when more files are chosen than there is room for', async () => {
      await open(Array.from({ length: 9 }, (_, index) => frame(index, index === 0)));

      pick(file('tenth.jpg'), file('eleventh.jpg'));
      await settle();

      http.expectOne(IMAGES_URL).flush(frame(9));
      await settle();
      http.expectNone(IMAGES_URL);
      expect(element.textContent).toContain('Галерея вміщає щонайбільше десять кадрів.');
    });
  });

  describe('errors from the server, in Ukrainian', () => {
    const cases = [
      { status: 409, code: 'gallery_full', text: 'Галерея вміщає щонайбільше десять кадрів.' },
      { status: 413, code: 'file_too_large', text: 'Файл більший за 10 МБ.' },
      { status: 422, code: 'invalid_file', text: 'Файл не є зображенням JPEG, PNG чи WebP.' },
      { status: 502, code: 'storage_unavailable', text: 'Сховище фото недоступне.' },
    ];

    for (const { status, code, text } of cases) {
      it(`explains ${code} and drops the preview`, async () => {
        await open([]);

        pick(file('front.jpg'));
        await settle();
        http.expectOne(IMAGES_URL).flush(failure(code), { status, statusText: 'Refused' });
        await settle();

        expect(element.textContent).toContain(text);
        expect(element.textContent).not.toContain(code);
        expect(count('pending-frame')).toBe(0);
        expect(host.reported).toEqual([]);
      });
    }
  });

  it('makes another frame the main one and takes the gallery from the answer (AC-03)', async () => {
    await open([frame(0, true), frame(1)]);

    button('Зробити головним').click();
    await settle();

    const request = http.expectOne(`${IMAGES_URL}/${frame(1).id}/main`);
    expect(request.request.method).toBe('PUT');
    request.flush([frame(0), frame(1, true)]);
    await settle();

    expect(host.images()).toEqual([frame(0), frame(1, true)]);
  });

  describe('deleting a frame', () => {
    it('asks first and sends nothing when the admin backs out', async () => {
      await open([frame(0, true), frame(1)]);

      button('Видалити фото').click();
      await settle();
      await answerConfirmation('Скасувати');

      http.expectNone(`${IMAGES_URL}/${frame(0).id}`);
      expect(count('frame')).toBe(2);
    });

    it('removes the frame once the server has deleted it', async () => {
      await open([frame(0, true), frame(1)]);

      button('Видалити фото').click();
      await settle();
      await answerConfirmation('Видалити');

      const request = http.expectOne(`${IMAGES_URL}/${frame(0).id}`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(host.images()).toEqual([frame(1)]);
    });

    it('keeps the frame and explains why when storage is unavailable', async () => {
      await open([frame(0, true)]);

      button('Видалити фото').click();
      await settle();
      await answerConfirmation('Видалити');

      http
        .expectOne(`${IMAGES_URL}/${frame(0).id}`)
        .flush(failure('storage_unavailable'), { status: 502, statusText: 'Bad Gateway' });
      await settle();

      expect(count('frame')).toBe(1);
      expect(element.textContent).toContain('Сховище фото недоступне.');
    });

    it('treats a frame that is already gone as removed, not as an error', async () => {
      await open([frame(0, true), frame(1)]);

      [...element.querySelectorAll<HTMLButtonElement>('[aria-label="Видалити фото"]')][1]?.click();
      await settle();
      await answerConfirmation('Видалити');

      http
        .expectOne(`${IMAGES_URL}/${frame(1).id}`)
        .flush(failure('image_not_found'), { status: 404, statusText: 'Not Found' });
      await settle();

      expect(host.images()).toEqual([frame(0, true)]);
      expect(element.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
