import { preparationQueue, type PgBoss } from '../../queue.ts';

export type RewritableCardField =
  'titleProm' | 'titleOlx' | 'descriptionProm' | 'descriptionOlx' | 'seoKeywords';

export type PreparationRunJob =
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'texts' | 'price' | 'both';
    }
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'field';
      readonly field: RewritableCardField;
      readonly draftText: string;
    };

export class PreparationQueue {
  constructor(private readonly boss: PgBoss) {}

  /**
   * The run id is the job id, and pg-boss ignores a second send with an id it already holds: a run
   * can be queued again whenever its send may have been lost, and it still runs once.
   */
  async enqueue(job: PreparationRunJob): Promise<void> {
    await this.boss.send(preparationQueue.name, job, { id: job.runId });
  }
}
