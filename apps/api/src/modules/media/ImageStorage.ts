import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { StorageUnavailable } from './MediaErrors.ts';

export type ImageStorageOptions = {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly maxAttempts: number;
  readonly connectionTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly deleteBatchSize: number;
};

/**
 * The only file that knows the S3 SDK. Every SDK failure leaves as `StorageUnavailable` with the
 * original as its cause, so nothing above this class branches on SDK error shapes.
 */
export class ImageStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly deleteBatchSize: number;

  constructor(options: ImageStorageOptions) {
    this.bucket = options.bucket;
    this.deleteBatchSize = options.deleteBatchSize;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      maxAttempts: options.maxAttempts,
      requestHandler: {
        connectionTimeout: options.connectionTimeoutMs,
        requestTimeout: options.requestTimeoutMs,
      },
    });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.attempt(() =>
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    );
  }

  /** S3 answers 204 for a key that does not exist, so a repeated delete succeeds. */
  async delete(key: string): Promise<void> {
    await this.attempt(() =>
      this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })),
    );
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    for (let start = 0; start < keys.length; start += this.deleteBatchSize) {
      const batch = keys.slice(start, start + this.deleteBatchSize);
      const output = await this.attempt(() =>
        this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: true },
          }),
        ),
      );
      // A batch delete reports per-key failures in the body of a 200, not as a thrown error.
      if (output.Errors !== undefined && output.Errors.length > 0) {
        throw new StorageUnavailable(
          new Error(
            `R2 refused to delete ${String(output.Errors.length)} of ${String(batch.length)} objects: ` +
              output.Errors.map((error) => error.Code ?? 'unknown').join(', '),
          ),
        );
      }
    }
  }

  private async attempt<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new StorageUnavailable(error);
    }
  }
}
