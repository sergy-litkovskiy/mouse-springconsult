---
name: mouse-commands
description: >
  Довідник команд для щоденної роботи в репозиторії mouse-springconsult:
  docker compose (up/down/logs/restart), збірка й перевірки (build, typecheck,
  lint, format, test, deps:check) для api та web, встановлення залежностей,
  міграції БД (db:create, db:migrate, db:migrate:new), Angular CLI. Вмикати,
  коли потрібно згадати точну команду або прапорець для запуску, тестування,
  лінтингу чи роботи з базою даних у цьому проєкті — "як запустити тести",
  "як накотити міграцію", "docker compose команди", "npm run для api/web".
---

# Команди (mouse-springconsult)

**Усе виконується всередині контейнерів.** Прямої розробки на хості немає: ні
`npm install`, ні `npm run`, ні `ng` на локальній машині не запускаються. Node,
npm і Angular CLI на хості не потрібні взагалі.

```bash
# Щоденний цикл
docker compose up --build         # postgres, api, worker, web у watch-режимі
docker compose down
docker compose logs -f api        # api | worker | web | postgres
docker compose restart worker
docker compose ps

# Разові команди — через контейнер. --no-deps не піднімає postgres там, де він не потрібен.
docker compose run --rm --no-deps api npm run build       # tsc → dist/
docker compose run --rm --no-deps api npm run typecheck   # tsc --noEmit, без емісії
docker compose run --rm --no-deps api npm run lint
docker compose run --rm api npm run test                  # tsc + node --test; потребує Postgres
docker compose run --rm --no-deps api npm run deps:check
docker compose run --rm --no-deps api npm run format
docker compose run --rm --no-deps web npm run lint        # ESLint, зокрема межі між фічами
docker compose run --rm --no-deps web npm run test        # vitest через @angular/build:unit-test

# Залежності. Кожен застосунок має власний package.json і власний том node_modules,
# тому прапорець -w не потрібен: команда виконується всередині потрібного контейнера.
docker compose run --rm --no-deps api npm install <pkg>
docker compose build api

# База
docker compose run --rm api npm run db:create           # ідемпотентно створює mouse_trading
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:migrate:revert
docker compose run --rm api npm run db:migrate:new -- <name>   # тільки створює файл
docker compose exec postgres psql -U $POSTGRES_USER postgres

# Angular CLI
docker compose run --rm --no-deps web npx ng generate component products/form/product-form
```

`npm run test` — єдина команда без `--no-deps`: репозиторії, конвертери цін і
обмеження схеми перевіряються на справжньому Postgres. Тестова база — двійник
`DATABASE_URL` із суфіксом `_test`; окремої env-змінної під неї немає, створює
й мігрує її сам прогін (`db/test-database.ts`). Перелік міграцій руками не
ведеться: `db/migrations-glob.ts` віддає директорію `db/migrations/` цілком, а
порядок визначає timestamp у кінці **імені класу** — `db:migrate:new` лише
створює файл, реєструвати його окремо не треба.

`test` і `dev` запускають `tsc` самі, тому окремо викликати `build` перед ними не
потрібно. Решта команд працює з `dist/`, який лишається від попередньої збірки:
`db:migrate` на чистому клоні виконують після `npm run build` (або через
`docker compose run --rm migrate`, який збирає сам).

Повний перелік команд (бекап, черга, `down -v`, `ng build`) — у README.

Чому так жорстко: `sharp` і `argon2` — нативні модулі. Встановлені на macOS, вони
не запустяться в Linux-контейнері, тому `node_modules` живуть в іменованому volume,
а не приїжджають з хоста. `npm install` на хості не просто зайвий — він створив би
каталог, який ламає контейнер, щойно його змонтують всередину.

Makefile навмисно не заводимо: `docker compose` уже є інтерфейсом, а обгортка над
ним лише додає рівень, який доводиться тримати в голові. Деплой виконує GitHub
Actions при пуші в `main`; ручний шлях по SSH (є в README) — аварійний, на випадок
недоступності Actions, а не звичайний спосіб викотити зміни.
