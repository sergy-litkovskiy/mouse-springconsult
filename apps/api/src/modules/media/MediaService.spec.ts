import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { productConstraints } from '../../contracts/products-limits.ts';
import { ImageStorage } from './ImageStorage.ts';
import { FileTooLarge, InvalidFile, StorageUnavailable } from './MediaErrors.ts';
import { MediaService } from './MediaService.ts';

const KEY = 'products/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

/** A file of the given length whose leading bytes are the signature; the rest is zero-filled. */
function file(signature: readonly number[], length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(signature);
  return bytes;
}

/** Never talks to R2: every method that would reach the S3 client is overridden. */
class RecordingImageStorage extends ImageStorage {
  readonly calls: (
    | { method: 'put'; key: string; body: Uint8Array; contentType: string }
    | { method: 'delete'; key: string }
    | { method: 'deleteMany'; keys: readonly string[] }
  )[] = [];

  constructor(private readonly failure?: Error) {
    super({
      accountId: 'test-account',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
      maxAttempts: 1,
      connectionTimeoutMs: 1,
      requestTimeoutMs: 1,
      deleteBatchSize: 1000,
    });
  }

  override async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.calls.push({ method: 'put', key, body, contentType });
    this.failIfAsked();
  }

  override async delete(key: string): Promise<void> {
    this.calls.push({ method: 'delete', key });
    this.failIfAsked();
  }

  override async deleteMany(keys: readonly string[]): Promise<void> {
    this.calls.push({ method: 'deleteMany', keys });
    this.failIfAsked();
  }

  private failIfAsked(): void {
    if (this.failure !== undefined) {
      throw this.failure;
    }
  }
}

function setup(failure?: Error): { media: MediaService; storage: RecordingImageStorage } {
  const storage = new RecordingImageStorage(failure);
  return { media: new MediaService(storage), storage };
}

describe('media service — store', () => {
  it('puts a valid JPEG into storage and returns its key (AC-01)', async () => {
    const { media, storage } = setup();
    const bytes = file(JPEG_SIGNATURE);

    const key = await media.store(bytes, KEY);

    assert.equal(key, KEY);
    assert.deepEqual(storage.calls, [
      { method: 'put', key: KEY, body: bytes, contentType: 'image/jpeg' },
    ]);
  });

  it('stores a PNG under the type its content declares, not the one the browser sent (DoD)', async () => {
    const { media, storage } = setup();

    await media.store(file(PNG_SIGNATURE), KEY);

    assert.deepEqual(
      storage.calls.map((call) => (call.method === 'put' ? call.contentType : call.method)),
      ['image/png'],
    );
  });

  it('accepts a WebP by its RIFF/WEBP signature (Checklist 1)', async () => {
    const { media, storage } = setup();

    await media.store(file(WEBP_SIGNATURE), KEY);

    assert.deepEqual(
      storage.calls.map((call) => (call.method === 'put' ? call.contentType : call.method)),
      ['image/webp'],
    );
  });

  it('rejects content that is not an image before touching storage (AC PRD 6.1)', async () => {
    const { media, storage } = setup();
    const notAnImage = new TextEncoder().encode('%PDF-1.7\n<< /Type /Catalog >>');

    await assert.rejects(media.store(notAnImage, KEY), InvalidFile);
    assert.equal(storage.calls.length, 0);
  });

  it('rejects an image type outside the allowed list (Checklist 1)', async () => {
    const { media, storage } = setup();

    await assert.rejects(media.store(file(GIF_SIGNATURE), KEY), InvalidFile);
    assert.equal(storage.calls.length, 0);
  });

  it('accepts a file exactly at the size limit (Checklist 5)', async () => {
    const { media, storage } = setup();

    const key = await media.store(file(JPEG_SIGNATURE, productConstraints.maxImageBytes), KEY);

    assert.equal(key, KEY);
    assert.equal(storage.calls.length, 1);
  });

  it('rejects a file one byte over the limit before touching storage (Checklist 5)', async () => {
    const { media, storage } = setup();

    await assert.rejects(
      media.store(file(JPEG_SIGNATURE, productConstraints.maxImageBytes + 1), KEY),
      (error: unknown) => {
        assert.ok(error instanceof FileTooLarge);
        assert.deepEqual(error.details, { maxBytes: productConstraints.maxImageBytes });
        return true;
      },
    );
    assert.equal(storage.calls.length, 0);
  });

  it('lets StorageUnavailable through when storage is down (Checklist 5)', async () => {
    const { media } = setup(new StorageUnavailable(new Error('connection reset by peer')));

    await assert.rejects(media.store(file(JPEG_SIGNATURE), KEY), StorageUnavailable);
  });
});

describe('media service — remove', () => {
  it('deletes a single object by its key (Checklist 2)', async () => {
    const { media, storage } = setup();

    await media.remove(KEY);

    assert.deepEqual(storage.calls, [{ method: 'delete', key: KEY }]);
  });

  it('deletes several objects in one storage call (Checklist 2)', async () => {
    const { media, storage } = setup();
    const keys = [KEY, `${KEY}-second`];

    await media.removeMany(keys);

    assert.deepEqual(storage.calls, [{ method: 'deleteMany', keys }]);
  });

  it('lets StorageUnavailable through when a delete fails (Checklist 2)', async () => {
    const { media } = setup(new StorageUnavailable(new Error('connection reset by peer')));

    await assert.rejects(media.remove(KEY), StorageUnavailable);
    await assert.rejects(media.removeMany([KEY]), StorageUnavailable);
  });
});
