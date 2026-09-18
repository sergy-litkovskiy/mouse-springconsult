import { PgBoss, type Queue } from 'pg-boss';
import { config, env } from './config.ts';
import { logger } from './logger.ts';

export type { PgBoss };

export const preparationQueue: Queue = {
  name: config.queue.preparation.name,
  retryLimit: config.queue.preparation.retryLimit,
  retryDelay: config.queue.preparation.retryDelaySeconds,
  retryBackoff: config.queue.preparation.retryBackoff,
  expireInSeconds: config.queue.preparation.expireInSeconds,
};

/**
 * Starts pg-boss (it installs or migrates its own schema) and brings every queue in line with
 * `config`: settings are stored on the queue row, so an existing queue is updated rather than
 * left with the values it was first created with.
 */
export async function startQueue(queues: readonly Queue[]): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: config.queue.schema,
    max: config.queue.poolSize,
  });
  // An EventEmitter without an `error` listener throws, and pg-boss emits there on every failed
  // maintenance or polling round — a dropped connection would take the whole process down.
  boss.on('error', (error) => {
    logger.error({ err: error }, 'queue error');
  });
  await boss.start();

  for (const { name, ...options } of queues) {
    if (await boss.getQueue(name)) {
      await boss.updateQueue(name, options);
    } else {
      await boss.createQueue(name, options);
    }
  }

  return boss;
}
