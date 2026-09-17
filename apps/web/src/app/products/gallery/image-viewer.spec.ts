import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import type { ProductImage } from '@contracts/products.contract';
import { ImageViewer, type ImageViewerData } from './image-viewer';

function frame(index: number, position: number, isMain = false): ProductImage {
  const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`;
  return {
    id,
    r2Key: `products/card/${id}`,
    url: `https://r2.example.com/products/card/${id}`,
    position,
    isMain,
  };
}

describe('ImageViewer', () => {
  let dialog: MatDialog;

  async function open(images: readonly ProductImage[]): Promise<void> {
    TestBed.configureTestingModule({
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
    dialog = TestBed.inject(MatDialog);
    dialog.open<ImageViewer, ImageViewerData>(ImageViewer, {
      data: { title: 'Миша Logitech MX Master 3', images },
    });
    await settle();
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  afterEach(async () => {
    dialog.closeAll();
    await settle();
  });

  /** The dialog lives in the overlay container on the body, not inside any fixture. */
  function overlay(): HTMLElement {
    const container = document.querySelector<HTMLElement>('mat-dialog-container');
    if (container === null) {
      throw new Error('no open dialog');
    }
    return container;
  }

  function shown(): string {
    return overlay().querySelector<HTMLImageElement>('[data-testid="viewer-frame"]')?.src ?? '';
  }

  function position(): string {
    return (
      overlay()
        .querySelector('[data-testid="viewer-position"]')
        ?.textContent.replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  function button(label: string): HTMLButtonElement {
    const found = overlay().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (found === null) {
      throw new Error(`no button «${label}»`);
    }
    return found;
  }

  async function press(key: string): Promise<void> {
    overlay().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await settle();
  }

  // Positions deliberately differ from the array order: the viewer sorts, it does not trust it.
  const FIRST = frame(1, 0);
  const MAIN = frame(2, 1, true);
  const LAST = frame(3, 2);
  const THREE = [LAST, MAIN, FIRST];

  it('opens on the main frame and counts it as the first (AC-40)', async () => {
    await open(THREE);

    expect(shown()).toContain(MAIN.id);
    expect(position()).toBe('1 / 3');
    expect(button('Попереднє фото').disabled).toBe(true);
  });

  it('walks the other frames in position order with the button and the arrow keys (AC-40)', async () => {
    await open(THREE);

    button('Наступне фото').click();
    await settle();
    expect(shown()).toContain(FIRST.id);
    expect(position()).toBe('2 / 3');

    await press('ArrowRight');
    expect(shown()).toContain(LAST.id);
    expect(position()).toBe('3 / 3');

    await press('ArrowLeft');
    expect(shown()).toContain(FIRST.id);
  });

  it('stays on the last frame when asked to go further (AC-40)', async () => {
    await open(THREE);
    await press('ArrowRight');
    await press('ArrowRight');

    expect(button('Наступне фото').disabled).toBe(true);
    await press('ArrowRight');
    expect(shown()).toContain(LAST.id);
    expect(position()).toBe('3 / 3');
  });

  it('jumps to a frame picked in the strip', async () => {
    await open(THREE);

    const thumbs = overlay().querySelectorAll<HTMLButtonElement>('[data-testid="viewer-thumb"]');
    expect(thumbs.length).toBe(3);
    thumbs[2]?.click();
    await settle();

    expect(shown()).toContain(LAST.id);
    expect(thumbs[2]?.getAttribute('aria-current')).toBe('true');
  });

  it('shows a single frame without a strip and with both directions closed', async () => {
    await open([MAIN]);

    expect(position()).toBe('1 / 1');
    expect(overlay().querySelectorAll('[data-testid="viewer-thumb"]').length).toBe(0);
    expect(button('Попереднє фото').disabled).toBe(true);
    expect(button('Наступне фото').disabled).toBe(true);
  });
});
