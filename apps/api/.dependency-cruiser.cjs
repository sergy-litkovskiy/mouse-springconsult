/**
 * Dependency rules of apps/api. This is the executable form of the diagram in ARCHITECTURE.md:
 *
 *   src/api.ts · src/worker.ts · db/*.ts      composition root
 *          ▼
 *   modules/<feature>/
 *      *Controller.ts ─► *Service.ts ─► *Repository.ts ─► entity classes
 *          ▼
 *   config.ts · db.ts · logger.ts · errors.ts · contracts/
 *
 * Layers are marked by the suffix of the class name, so the rules are written as name
 * globs rather than directories.
 */
const MODULE_INDEX = '^src/modules/[^/]+/index\\.ts$';
const CONTROLLERS = '^src/modules/[^/]+/[^/]*Controller\\.ts$';
const SERVICES = '^src/modules/[^/]+/[^/]*Service\\.ts$';
const REPOSITORIES = '^src/modules/[^/]+/[^/]*Repository\\.ts$';
/**
 * Entity classes carry no suffix — the class is the model — so they are listed by name.
 * A new entity is added here, and that is the whole point of the list: adding one is a
 * decision about where the ORM is allowed to appear.
 */
const ENTITIES = '^src/modules/[^/]+/(User|Product|ProductImage)\\.ts$';
// depcruise matches `to.path` against the *resolved* path, not against the package name.
const ORM_PACKAGES = '^node_modules/(typeorm|pg)(/|$)';

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
      name: 'repository-is-the-bottom-layer',
      severity: 'error',
      comment:
        'A repository knows about entities and the ORM, and about nothing above it. ' +
        'An import of a service or a controller from here means the layers are inverted.',
      from: { path: REPOSITORIES },
      to: { path: [SERVICES, CONTROLLERS] },
    },

    {
      name: 'service-knows-nothing-about-http',
      severity: 'error',
      comment:
        'A service holds business logic and is called from a controller, never the other ' +
        'way round. HTTP — fastify, DTOs, cookies — stays in the controller.',
      from: { path: SERVICES },
      to: { path: CONTROLLERS },
    },

    {
      name: 'controller-goes-through-the-service',
      severity: 'error',
      comment:
        'A controller talks to a service, not to a repository: business logic must not be ' +
        'reachable around the layer that owns it.',
      from: { path: CONTROLLERS },
      to: { path: REPOSITORIES },
    },

    {
      name: 'orm-stays-in-repositories-and-entities',
      severity: 'error',
      comment:
        'typeorm and pg appear in repositories, in entity classes and in the composition ' +
        'root — nowhere else. A service that reaches for a QueryBuilder has swallowed the ' +
        'layer below it, and a controller that does has swallowed two.',
      from: {
        path: '^src/modules/',
        pathNot: [REPOSITORIES, ENTITIES, MODULE_INDEX, '\\.spec\\.ts$'],
      },
      to: { dependencyTypes: ['npm'], path: ORM_PACKAGES },
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
      name: 'test-database-stays-in-tests',
      severity: 'error',
      comment:
        'db/test-database.ts creates and migrates the throwaway `_test` twin of the ' +
        'database and truncates its tables. Nothing but a spec has a reason to touch it.',
      from: { pathNot: '\\.spec\\.ts$' },
      to: { path: '^db/test-database\\.ts$' },
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
