/**
 * Dependency rules of apps/api. This is the executable form of the diagram in ARCHITECTURE.md:
 *
 *   api.ts / worker.ts / db/*.ts        composition root
 *          ▼
 *   modules/<feature>/
 *      *.routes.ts ─► *.use-case.ts ─► *.port.ts · domain types
 *                                          ▲
 *              *.repository.ts · *.adapter.ts · *.entity.ts
 *          ▼
 *   config.ts · db.ts · logger.ts · errors.ts · contracts/
 *
 * Layers are marked by file-name suffixes, so the rules are written as name globs
 * rather than directories.
 */
const COMPOSITION_ROOT = '^(src/(api|worker)\\.ts|db/[^/]+\\.ts)$';
const INFRASTRUCTURE = '^src/modules/[^/]+/[^/]+\\.(repository|adapter|entity)\\.ts$';
// depcruise matches `to.path` against the *resolved* path, not against the package name.
const IO_PACKAGES =
  '^node_modules/(pg|typeorm|fastify|@fastify/|argon2|jose|@aws-sdk/|@anthropic-ai/sdk|pino)';

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle between files is always an architecture error.',
      from: {},
      to: { circular: true },
    },

    {
      name: 'tech-services-know-nothing-about-modules',
      severity: 'error',
      comment:
        'config.ts, db.ts, logger.ts and errors.ts do not know that business modules exist. ' +
        'Otherwise the technical layer stops being technical.',
      from: { path: '^src/(config|db|logger|queue|errors)\\.ts$' },
      to: { path: '^src/modules/' },
    },

    {
      name: 'contracts-are-pure',
      severity: 'error',
      comment: 'contracts/ holds pure zod schemas: no modules, no technical services, no I/O.',
      from: { path: '^src/contracts/(?!.*\\.spec\\.ts$)' },
      to: { path: '^src/(modules|api\\.ts|worker\\.ts|db\\.ts|logger\\.ts|config\\.ts)' },
    },

    {
      name: 'ports-and-domain-have-no-io',
      severity: 'error',
      comment:
        'Ports and domain types do not import pg, typeorm, fastify, argon2 or jose. ' +
        'That is precisely why the domain can be tested without infrastructure. ' +
        'Domain files carry no layer suffix, so each one is listed by name: a new domain ' +
        'type is unchecked until it is added here.',
      from: { path: '^src/modules/[^/]+/([^/]+\\.(port|use-case)\\.ts|(user|product)\\.ts)$' },
      to: { dependencyTypes: ['npm'], path: IO_PACKAGES },
    },

    {
      name: 'use-case-depends-on-ports-only',
      severity: 'error',
      comment:
        'A use-case depends on a port, not on its implementation: swapping Postgres for ' +
        'an in-memory double in a test must not touch business logic.',
      from: { path: '^src/modules/[^/]+/[^/]+\\.use-case\\.ts$' },
      to: { path: '^src/modules/[^/]+/[^/]+\\.(repository|adapter|entity|routes)\\.ts$' },
    },

    {
      name: 'routes-carry-no-infrastructure',
      severity: 'error',
      comment:
        '*.routes.ts maps HTTP onto use-cases; implementations are wired by the composition root.',
      from: { path: '^src/modules/[^/]+/[^/]+\\.routes\\.ts$' },
      to: { path: INFRASTRUCTURE },
    },

    {
      name: 'implementations-only-from-composition-root',
      severity: 'error',
      comment:
        'Repositories, adapters and ORM entities are instantiated only by api.ts, worker.ts ' +
        'or a script in db/ — plus the module index.ts that publishes them.',
      from: {
        path: '^(src|db)/',
        pathNot: [
          COMPOSITION_ROOT,
          '^src/modules/[^/]+/index\\.ts$',
          INFRASTRUCTURE,
          // An adapter test is the only place that needs the implementation directly.
          '\\.spec\\.ts$',
        ],
      },
      to: { path: INFRASTRUCTURE },
    },

    {
      name: 'no-deep-import-between-modules',
      severity: 'error',
      comment: 'A module sees another module only through its index.ts.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/(?!index\\.ts$)',
        pathNot: '^src/modules/$1/',
      },
    },

    {
      name: 'test-doubles-stay-in-tests',
      severity: 'error',
      comment: '*.fixtures.ts holds test doubles for ports; they have no place in runtime code.',
      from: { pathNot: '\\.spec\\.ts$' },
      to: { path: '\\.fixtures\\.ts$' },
    },

    {
      name: 'no-unresolvable',
      severity: 'error',
      comment: 'An import that does not resolve is a broken import.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.mjs', '.cjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
