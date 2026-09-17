import type { ImageStorage } from './ImageStorage.ts';

export class MediaService {
  constructor(private readonly storage: ImageStorage) {}

  async store(bytes: Uint8Array, key: string): Promise<string> {
    throw new Error('Not implemented');
  }

  async remove(key: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async removeMany(keys: readonly string[]): Promise<void> {
    throw new Error('Not implemented');
  }
}
