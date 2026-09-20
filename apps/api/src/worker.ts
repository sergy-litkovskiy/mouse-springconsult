import { config, env } from './config.ts';
import { createDataSource } from './db.ts';
import { logger } from './logger.ts';
import { AnthropicAdapter, PreparationService, type PreparationJob } from './modules/ai/index.ts';
import { ImageStorage, MediaService } from './modules/media/index.ts';
import {
  FieldSuggestion,
  PreparationRepository,
  PreparationRun,
  Product,
  ProductImage,
  ProductRepository,
} from './modules/products/index.ts';
import { preparationQueue, startQueue } from './queue.ts';

async function main(): Promise<void> {
  // Optional in the schema so that tests and the api start without it; the worker cannot.
  if (env.ANTHROPIC_API_KEY === undefined) {
    throw new Error('ANTHROPIC_API_KEY is required by the worker');
  }

  const dataSource = createDataSource({
    entities: [Product, ProductImage, PreparationRun, FieldSuggestion],
  });
  await dataSource.initialize();

  const preparation = new PreparationService(
    new AnthropicAdapter(env.ANTHROPIC_API_KEY),
    new PreparationRepository(dataSource),
    new ProductRepository(dataSource),
    new MediaService(
      new ImageStorage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
        ...config.storage,
      }),
    ),
  );

  const queue = await startQueue([preparationQueue]);

  // Naming the job type turns off inference of the options, and with it the metadata fields.
  await queue.work<
    PreparationJob,
    unknown,
    { pollingIntervalSeconds: number; includeMetadata: true }
  >(
    preparationQueue.name,
    { pollingIntervalSeconds: config.queue.pollingIntervalSeconds, includeMetadata: true },
    async (jobs) => {
      for (const job of jobs) {
        const log = logger.child({ jobId: job.id, runId: job.data.runId, scope: job.data.scope });
        log.info({ waitMs: Date.now() - job.createdOn.getTime() }, 'job started');
        try {
          await preparation.prepare(job.data);
          log.info('job finished');
        } catch (error) {
          // pg-boss retries a thrown job on its own; only the last attempt closes the run.
          if (job.retryCount >= job.retryLimit) {
            await preparation.abandon(job.data.runId);
          }
          log.error({ err: error, retryCount: job.retryCount }, 'job failed');
          throw error;
        }
      }
    },
  );
  logger.info({ queue: preparationQueue.name }, 'worker subscribed');

  async function sweepStuckRuns(): Promise<void> {
    try {
      const closed = await preparation.closeStuckRuns();
      if (closed > 0) {
        logger.warn({ closed }, 'closed stuck preparation runs');
      }
    } catch (error) {
      // A failed sweep must not take the worker down: the next round tries again.
      logger.error({ err: error }, 'stuck run sweep failed');
    }
  }

  // The first sweep is at startup, because a worker coming back up is precisely when the runs its
  // own death left behind are waiting.
  await sweepStuckRuns();
  const sweep = setInterval(() => {
    void sweepStuckRuns();
  }, config.queue.preparation.stuckSweepIntervalSeconds * 1000);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      logger.info({ signal }, 'shutting down');
      clearInterval(sweep);
      void queue
        .stop({ graceful: true })
        .then(() => dataSource.destroy())
        .then(() => {
          process.exit(0);
        });
    });
  }
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start worker');
  process.exit(1);
});
