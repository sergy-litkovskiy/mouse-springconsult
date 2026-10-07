---
name: feature-ship
description: "Takes a written feature in the mouse-springconsult repository to green and commits it — ten quality gates run in containers in cost order, down/up migration verification, smoke requests against the live stack, documentation updates, closing the story and its tracker row when the work came from one, and a Conventional Commits commit. Use when the user asks to run the checks, lint, typecheck or tests, to verify a migration, or says the feature is done, ready to commit or ready to ship. Does not write feature code."
---

# Take a feature to green

Run the steps in order; each one is cheaper than the next and filters what would
otherwise be hunted in a longer cycle.

## 1. Format before lint

Prettier rearranges what ESLint would otherwise complain about, so part of the lint
output is phantom until formatting has run.

```bash
docker compose run --rm --no-deps api npm run format
docker compose run --rm --no-deps web npm run format
```

## 2. Ten gates

```bash
docker compose run --rm --no-deps api npm run format:check
docker compose run --rm --no-deps api npm run lint
docker compose run --rm --no-deps api npm run typecheck
docker compose run --rm --no-deps api npm run deps:check
docker compose run --rm --no-deps api npm run build
docker compose run --rm api npm run test
docker compose run --rm --no-deps web npm run format:check
docker compose run --rm --no-deps web npm run lint
docker compose run --rm --no-deps web npm run test
docker compose run --rm --no-deps web npm run build
```

Skip none. `deps:check` is the architecture in executable form, and `web build`
catches what `lint` cannot — an unresolvable `@contracts` path, or a bundle that
grew. The web side has no separate typecheck gate on purpose: `build` covers it.

`api npm run test` is the one command **without** `--no-deps`: the repository and
schema specs run against a real Postgres. It compiles first, so a failure there is a
`tsc` failure, not a test failure — read the top of the output.

### Symptom to cause

| Symptom | Cause |
|---|---|
| `deps:check`: `no-deep-import-between-modules` | an import bypassing a neighbouring module's `index.ts` |
| `deps:check`: `orm-stays-in-repositories-and-entities` | `typeorm`/`pg` in a service or controller (`import type` counts), or a new entity class missing from the `ENTITIES` list |
| `deps:check`: `controller-goes-through-the-service` | a controller reaching for a repository instead of the service |
| `node: cannot find module dist/...` | `dist/` is stale or absent — run `npm run build` (or `docker compose run --rm migrate`, which builds itself) |
| a stack trace pointing at `.js` | the process was started without `--enable-source-maps` |
| bundle suddenly ~55 KB gzip larger | a runtime import from a `*.contract.ts` dragged zod in |
| an Angular test sees stale DOM | the microtask queue was not drained — see the feature-scaffold skill |
| `lint`: `no-unnecessary-condition` on a `?.` in a spec | the value is already narrowed — by an earlier `assert.equal` from `node:assert/strict`, or because `Element.textContent` is `string` in current DOM typings; drop the `?.` |
| a new route answers 404 while every gate is green | not the registration: under colima `node --watch` in the running `api` container misses host file changes — `docker compose restart api` |

## 3. The migration both ways

`down` is verified by running it, not by reading it. `db:migrate:revert` undoes
**one** migration per call, so run it once per migration the feature added — a
table plus a seed needs two — and check `db:migrate:show` in between:

```bash
docker compose run --rm migrate                     # build, create the database, migrate
docker compose run --rm --no-deps api npm run db:migrate:show
docker compose run --rm --no-deps api npm run db:migrate:revert
docker compose run --rm --no-deps api npm run db:migrate
```

Every `db:*` call here takes `--no-deps`, as the CI `migrations` job does. Without it
`docker compose run api` first starts the `migrate` service through `depends_on`, and
that service applies whatever is pending — so `db:migrate` reports nothing to do for a
migration it never ran, and the `up` half of the check proves nothing. The first line
leaves Postgres running and `dist/` fresh, which is all the `db:*` scripts need: they
run `dist/db/*.js`.

If a revert fails, or leaves an index or table behind, the migration is not ready.

## 4. Smoke against the live stack

```bash
docker compose up -d --build && docker compose ps    # api must be healthy
```

Then issue real requests. The host port comes from `.env` (`API_HOST_PORT`,
3000 by default). Mind the prefix asymmetry: straight to the api container the path
carries no prefix (`/auth/login`), while through Caddy or `ng serve` it is
`/api/auth/login` — `handle_path` strips the prefix. The session lives in an
httpOnly cookie, so curl needs a jar:

```bash
COOKIES=$(mktemp)
curl -s -c "$COOKIES" -X POST localhost:${API_HOST_PORT:-3000}/auth/login \
  -H 'content-type: application/json' -d '{"email":"...","password":"..."}'
curl -s -b "$COOKIES" localhost:${API_HOST_PORT:-3000}/<feature>/...
```

At minimum: the happy path, 401 without a session, 400 on an invalid payload, and
200 from the frontend page — which also exercises the `/api` proxy.

If the feature touched the schema or compose, verify from scratch:
`docker compose down -v && docker compose up -d --build`.

## 5. Documentation

- `ARCHITECTURE.md` — the module's state in the "Модулі" table;
- `CLAUDE.md` — the "Правила модулів" list, if the feature added a module-level `CLAUDE.md`;
- `apps/api/.dependency-cruiser.cjs` — the `ENTITIES` regex, if the feature added an entity;
- `README.md` and `.env.example` — if a command or an environment variable was added;
- `docs/adr/` for a project-wide decision, `docs/features/<slug>/adr/` for a feature's —
  a new ADR **only** when the decision contradicts an existing one or closes a fork for
  a long time. Do not write an ADR as ritual.

## 6. Story and tracker

Only when the work came from a story: the user named one (`T10`, a slug, a path), or
the work was driven from `docs/features/<slug>/tasks/<story>.md`, as `/tdd` is. Without
a story there is no tracker row to close — skip this step, and do not guess a story from
the diff.

`tracker.md` is the source of truth for status. The changes below go into the same
commit as the code. When the code is already committed — the `/tdd` agents commit their
own phases — they become a commit of their own: `docs(<slug>): mark <ID> done`.

1. **The story's DoD.** Tick an item only when the diff or a gate above proves it. An
   item moved elsewhere stays unticked, with a line saying where it went and why
   (`add-product-error-codes.md` shows the shape). An item that is simply not done means
   the story is not done: stop and tell the user rather than closing it.
2. **The story's frontmatter** — `status: Done`, `updated_at` set to today.
3. **The tracker row** — status `Done`; the tracker's own `updated_at` set to today.
4. **Rows it unblocks** — each `Blocked` row whose `blocked_by` are now all `Done`
   becomes `Todo`. Change the tracker row only; the dependents' story files are not
   where status is read from.
5. **"Готові до старту просто зараз"** — the `Todo` rows with no open `blocked_by`, plus
   one dated sentence about the story just closed: what it unblocked, or why it unblocked
   nothing because its dependents still wait on something else.

Then check that the edited tables still match the dependency graph:

```bash
python3 .claude/skills/feature-break-tasks/references/gate-check.py docs/features/<slug>/tasks/
```

## 7. Commit

Before `git add`, look at what is being staged. `.env`,
`environment.development.ts` and `node_modules` never enter a commit:

```bash
git status --short
git diff --cached --name-only | grep -Ei '(^|/)\.env$|node_modules|environment\.development\.ts' || echo "clean"
```

Conventional Commits in English: `feat(products): create and list product cards`.
Run `git push` **only** when the user asks: it publishes the work, and a push to `main`
runs CI on it. The project's `.claude/settings.json` denies `git push` as well.

## 8. Retrospective, when asked

`LOG.md` holds feature briefs, not a fixed retrospective format. When the user asks
for one, or wants to compare this feature against the previous, report honestly:

- which gates failed on the first run and why;
- where these skills did not help and the code had to be written by hand;
- what is worth folding into the skills next time.

Do not smooth it over: a step left uncovered is the input for the next iteration.
