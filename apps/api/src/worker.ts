import { config } from './config.ts';
import { createDataSource } from './db.ts';
import { logger } from './logger.ts';
import {
  FieldSuggestion,
  PreparationRun,
  Product,
  ProductImage,
} from './modules/products/index.ts';
import { preparationQueue, startQueue } from './queue.ts';

async function main(): Promise<void> {
  const dataSource = createDataSource({
    entities: [Product, ProductImage, PreparationRun, FieldSuggestion],
  });
  await dataSource.initialize();

  const queue = await startQueue([preparationQueue]);

  // No model call yet: the handler only proves that a job reaches the worker and how fast.
  await queue.work(
    preparationQueue.name,
    { pollingIntervalSeconds: config.queue.pollingIntervalSeconds, includeMetadata: true },
    async (jobs) => {
      for (const job of jobs) {
        logger.info(
          { queue: job.name, jobId: job.id, waitMs: Date.now() - job.createdOn.getTime() },
          'job started',
        );
      }
    },
  );
  logger.info({ queue: preparationQueue.name }, 'worker subscribed');

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      logger.info({ signal }, 'shutting down');
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
