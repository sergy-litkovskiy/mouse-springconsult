import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PROM_SYNC_RUNS_TABLE = 'product_prom_sync_runs';

export type PromSyncStatus = 'queued' | 'running' | 'succeeded' | 'failed';
/**
 * The first five are refusals: Prom created nothing for this run. The last two are partial results:
 * the product exists on Prom and `promProductId` is set, so a retry finishes it instead of creating
 * another one.
 */
export type PromSyncErrorCode =
  | 'prom_access_denied'
  | 'prom_busy'
  | 'prom_rejected'
  | 'prom_unavailable'
  | 'prom_timeout'
  | 'prom_photos_incomplete'
  | 'prom_not_draft';

/**
 * An event rather than an entity edited as a whole, so there is no `updated_at`. A `prom_timeout`
 * run is the one exception to "finished is final": checking it again puts it back to `running` with
 * a new deadline, since the import it waits for is the same one.
 */
@Entity({ name: PROM_SYNC_RUNS_TABLE })
export class PromSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ name: 'status', type: 'varchar', length: 16 })
  status!: PromSyncStatus;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode!: PromSyncErrorCode | null;

  @Column({ name: 'prom_import_id', type: 'varchar', length: 64, nullable: true })
  promImportId!: string | null;

  /** Moves to `products.prom_id` only when the run succeeds (ADR 0029). */
  @Column({ name: 'prom_product_id', type: 'varchar', length: 32, nullable: true })
  promProductId!: string | null;

  /** N of "photos K of N": the gallery as it was sent, which the card may have changed since. */
  @Column({ name: 'images_total', type: 'int' })
  imagesTotal!: number;

  @Column({ name: 'images_on_prom', type: 'int', nullable: true })
  imagesOnProm!: number | null;

  /** Part of the id of the next status-check job, so every check gets a job of its own (ADR 0027). */
  @Column({ name: 'check_count', type: 'int', default: 0 })
  checkCount!: number;

  @Column({ name: 'deadline_at', type: 'timestamptz', nullable: true })
  deadlineAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
