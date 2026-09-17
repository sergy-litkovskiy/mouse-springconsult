import { productConstraints, type AllowedImageType } from '../../contracts/products-limits.ts';
import type { ImageStorage } from './ImageStorage.ts';
import { FileTooLarge, InvalidFile } from './MediaErrors.ts';

export class MediaService {
  constructor(private readonly storage: ImageStorage) {}

  async store(bytes: Uint8Array, key: string): Promise<string> {
    if (bytes.length > productConstraints.maxImageBytes) {
      throw new FileTooLarge(productConstraints.maxImageBytes);
    }

    const startsWith = (signature: readonly number[], offset = 0): boolean =>
      bytes.length >= offset + signature.length &&
      signature.every((byte, index) => bytes[offset + index] === byte);

    let contentType: AllowedImageType;
    if (startsWith([0xff, 0xd8, 0xff])) {
      contentType = 'image/jpeg';
    } else if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      contentType = 'image/png';
    } else if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
      // RIFF is a generic container; bytes 4–7 are its length, and only the tag at 8 says WebP.
      contentType = 'image/webp';
    } else {
      throw new InvalidFile();
    }

    await this.storage.put(key, bytes, contentType);
    return key;
  }

  async remove(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  async removeMany(keys: readonly string[]): Promise<void> {
    await this.storage.deleteMany(keys);
  }
}
