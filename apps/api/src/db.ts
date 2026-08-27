import { DataSource, type DataSourceOptions } from 'typeorm';
import { config, env } from './config.ts';

/**
 * Technical service: TypeORM DataSource factory.
 *
 * It knows nothing about modules/ — entities and migrations come from the composition
 * root (`src/api.ts` for the HTTP process, `db/migrate.ts` for migrations).
 */
export type CreateDataSourceInput = {
  readonly entities?: DataSourceOptions['entities'];
  readonly migrations?: DataSourceOptions['migrations'];
  readonly url?: string;
};

export function createDataSource(input: CreateDataSourceInput = {}): DataSource {
  return new DataSource({
    type: 'postgres',
    url: input.url ?? env.DATABASE_URL,
    entities: input.entities ?? [],
    migrations: input.migrations ?? [],
    migrationsTableName: 'migrations',
    synchronize: config.db.synchronize,
    logging: false,
    poolSize: config.db.poolSize,
    connectTimeoutMS: config.db.connectTimeoutMs,
  });
}
