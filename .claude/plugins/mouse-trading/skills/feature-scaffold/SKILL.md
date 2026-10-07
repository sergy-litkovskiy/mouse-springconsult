---
name: feature-scaffold
description: "Creates the vertical slice for a feature in the mouse-springconsult modular monolith — contracts, entity, repository, service with tests, controller, migration, composition-root wiring, and the Angular feature with zoneless tests. Use when the user asks to generate, scaffold or implement a feature or an endpoint — create the products module, implement the upload endpoint, scaffold the media feature — with or without a prior plan. Writes code; quality gates and the commit belong to the feature-ship skill."
---

# Scaffold a vertical slice

Take the feature name from the user's request. If no plan exists yet, draft a short
one and show it before writing files.

Read the reference implementation before generating each file. The repository has
two slices that already exist end to end, and they are more accurate than any
template in this text:

| Creating | Read first |
|---|---|
| `<Entity>.ts` | `modules/auth/User.ts`, `modules/products/Product.ts` |
| `<Feature>Errors.ts` + spec | `modules/products/ProductErrors.ts` + `.spec.ts` |
| `<Entity>Repository.ts` + spec | `modules/products/ProductRepository.ts` + `.spec.ts` |
| `<Feature>Service.ts` + spec | `modules/auth/AuthService.ts` + `.spec.ts` |
| `<Feature>Controller.ts` | `modules/auth/AuthController.ts` |
| infrastructure class | `modules/auth/PasswordHasher.ts`, `SessionTokens.ts` |
| Angular feature-level api | `app/products/products-api.ts` |
| Angular screen in a sub-feature + spec | `app/products/catalog/product-catalog.ts` + `.spec.ts`, `app/auth/login/login-page.ts` + `.spec.ts` |
| Angular store, only for state outliving a screen | `app/auth/auth-store.ts` + `.spec.ts` |

Run everything in containers. The commands specific to scaffolding:

```bash
docker compose run --rm --no-deps api npm run build      # db:* scripts run dist/
docker compose run --rm --no-deps api npm run db:migrate:new -- create-products-table
docker compose run --rm --no-deps web npx ng generate component products/catalog/product-catalog
```

## Order of creation

Bottom-up, so every file rests on types that already exist:

1. `contracts/<feature>.contract.ts` (+ `<feature>-limits.ts` for runtime constants)
2. `contracts/error-codes.ts` — add the codes
3. `<Entity>.ts` → `<Feature>Errors.ts`
4. `<Entity>Repository.ts` + `.spec.ts` against a real Postgres
5. `<Feature>Service.ts` + `.spec.ts` with stub subclasses in the same file
6. infrastructure classes, if the feature has any
7. `<Feature>Controller.ts` → `index.ts`
8. migration — the file alone; `db/migrations-glob.ts` picks it up
9. `src/api.ts` — composition root
10. `apps/web/src/app/<feature>/<feature>-api.ts`, the screen in its sub-feature
    directory (`<feature>/<screen>/`), then `app.routes.ts`

## Classes, not factories

Dependencies go through the constructor as parameter properties
(`constructor(private readonly products: ProductRepository) {}`) and are created only
in `src/api.ts`. The backend is compiled by `tsc` (ADR 0003), so this syntax is
available — and so are the `@Entity`/`@Column` decorators that made the build
necessary in the first place.

Call `dataSource.getRepository(Entity)` inside the method, not in the constructor: a
stub subclass in a spec must be constructible without a live `DataSource`.

A Fastify handler is an **arrow field**, not a method — Fastify calls it detached and
a method would lose `this`. `register(app, guard)` mounts the routes.

Inject a `SystemClock`. Never call `Date.now()` inside a service.

Every `@Column` states its type explicitly (`{ type: 'varchar', length: 200 }`):
`verbatimModuleSyntax` erases a type-only import, so inferring from metadata would
depend on how the file happens to write its imports.

Domain errors extend `AppError` and state their own status code. Messages are
English; the frontend composes user-facing text from `code`.

## Backend tests

`node --test` over the compiled output; `npm run test` runs `tsc` first. Specs sit
beside the code they test.

Test doubles are **subclasses of the real class**, declared in the spec that uses
them, with `override` on every method they replace. No separate fixtures file: a fake
that lives apart from its test drifts into describing its own semantics.

What belongs where:

- SQL semantics — `ilike`, LIKE escaping, `decimal`, pagination stability — go into
  `<Entity>Repository.spec.ts` against a real Postgres. A JavaScript reimplementation
  of a `where` clause tests the reimplementation.
- Decisions — order of checks, what a query turns into, what is safe to hand out —
  go into `<Feature>Service.spec.ts` with stub subclasses.
- Schema constraints live in `db/schema.spec.ts` with raw SQL.

Prefer the real collaborator when it is cheap: `SessionTokens` is genuine in
`AuthService.spec.ts`, and that alone proves a token the service issues is a token it
accepts back.

Do not pin a date in the past when a JWT is involved — it is then expired against the
real clock. Round "now" to whole seconds instead: `iat`/`exp` have second precision.

## Controllers

`safeParse` the payload, throw `AppError` with `code: validation_failed` and
`details.fields` from `z.flattenError`, map the domain object into the DTO in a
private method. No business logic, and no repository — only the service.

A protected endpoint takes `authController.sessionGuard` from the composition root
and mounts it as a `preHandler`. Cross-module access goes through `index.ts`, never
a deep import.

## Angular

Standalone, signals, zoneless. Material 22: the prebuilt theme is already wired in
`styles.css`, there is no Sass; buttons use the new API (`matButton="filled"`).

Import `@contracts/*.contract` with `import type` only.

Features do not import each other. A sub-feature may import its sibling inside the same
feature — `catalog` opens the dialog from `gallery` — and anything two features need
moves up as a named file at the `app/` level (`app/confirm-dialog.ts`).

### Zoneless tests

One `whenStable()` is not enough for an asynchronous handler: the microtask queue
has to drain before the DOM reflects the result. Await stability, yield to a
`setTimeout(0)`, run change detection, then await stability again.

Fill forms through the DOM rather than the component instance — the test must see
what the user sees. Use `provideHttpClientTesting` with `HttpTestingController`, and
call `http.verify()` in `afterEach`.

## Wire it up before finishing

Creating the files is half the work. All seven registration points:

1. `modules/<feature>/index.ts` — the module's public API
2. `src/api.ts` → `entities` in `createDataSource`
3. `src/api.ts` → `new …Repository` → `new …Service` → `new …Controller`, then
   `app.register(async (instance) => { controller.register(instance, guard); }, { prefix })`
4. `contracts/error-codes.ts` → the new codes
5. `apps/web/src/app/app.routes.ts` → a lazy `loadComponent` route in the `children` of
   the guarded layout route, Ukrainian `title`; the guard comes from the parent
6. `apps/web/eslint.config.js` → `FEATURES`
7. `apps/api/.dependency-cruiser.cjs` → the `ENTITIES` regex; a new entity class fails
   `orm-stays-in-repositories-and-entities` until its name is in the alternation

Migrations need no registration: the glob in `db/migrations-glob.ts` reads the whole
directory.

Then hand over to the feature-ship skill.
