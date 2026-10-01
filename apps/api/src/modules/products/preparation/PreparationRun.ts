import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PREPARATION_RUNS_TABLE = 'product_preparation_runs';

export type PreparationScope = 'texts' | 'price' | 'both' | 'field';
export type PreparationStatus = 'queued' | 'running' | 'succeeded' | 'failed';
/**
 * `price_unavailable` — the texts of a `both` run were stored, only the price is missing (AC-10b).
 * `preparation_failed` — every retry of the job failed and the run has no suggestions (AC-10).
 */
export type PreparationErrorCode = 'price_unavailable' | 'preparation_failed';

/**
 * An event rather than an entity edited as a whole, so there is no `updated_at`: the moments that
 * matter are named `startedAt` and `finishedAt`.
 */
@Entity({ name: PREPARATION_RUNS_TABLE })
export class PreparationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ name: 'scope', type: 'varchar', length: 8 })
  scope!: PreparationScope;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string;

  @Column({ name: 'status', type: 'varchar', length: 16 })
  status!: PreparationStatus;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode!: PreparationErrorCode | null;

  /** The English message of the error that closed a failed run; null on the runs that failed before T50. */
  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail!: string | null;

  /** Without it the tokens cannot be turned into money once a cost ceiling appears. */
  @Column({ name: 'model', type: 'varchar', length: 64 })
  model!: string;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
