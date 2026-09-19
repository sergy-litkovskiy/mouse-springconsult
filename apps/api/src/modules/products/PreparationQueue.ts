import type { PgBoss } from '../../queue.ts';

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

  async enqueue(job: PreparationRunJob): Promise<void> {
    throw new Error('Not implemented');
  }
}
