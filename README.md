# mouse-springconsult

Адмінка для підготовки, зберігання та редагування карток комісійних товарів, які
продаються на **Prom** і **OLX**. Завантажене фото автоматично розпізнається,
для товару генеруються SEO-опис, SEO-тексти та діапазон ринкових цін по Україні.

Домен: `mouse.springconsult.com.ua` · Обсяг: 50–100 товарів на місяць

> **Стан репозиторію: реалізовано фічі `auth` і `products`.**
>
> *Є зараз:* оточення Docker Compose (`postgres`, `migrate`, `api`, `web`), Caddy для
> проду, GitHub Actions, ESLint + Prettier + dependency-cruiser на обидва застосунки.
> Бекенд: вхід, вихід, перевірка сесії, сутності `users` і `products` з галереєю,
> міграції, список товарів з пагінацією, фільтрами й сортуванням — 57 юніт-тестів.
> Фронт: сторінка входу, guard і зворотний guard, 401-інтерсептор, оболонка з
> тулбаром і каталог товарів, стан якого живе в URL, — 38 тестів.
>
> *Ще немає:* модулів `media` і `ai` — це порожні теки каркаса. Немає `worker.ts` і
> черги: асинхронної роботи поки немає, а порожній воркер був би каркасом про запас.
> Вони зʼявляться разом із першою задачею для черги.

## Документація

| Файл | Про що |
|---|---|
| [SPEC.md](SPEC.md) | Цілі, межі, технічні рішення, критерії приймання |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Схема розгортання, модулі, dependency rule |
| [CLAUDE.md](CLAUDE.md) | Правила залежностей, конвенції, команди |
| [docs/adr/0001](docs/adr/0001-initial-setup.md) | Початкова архітектура: модульний моноліт, черга в Postgres, бекенд без збірки |
| [docs/adr/0002](docs/adr/0002-auth-jwt-and-typeorm.md) | Авторизація: JWT у httpOnly-cookie, TypeORM у шарі інфраструктури |
| [docs/adr/0003](docs/adr/0003-three-layer-classes.md) | Тришарова архітектура на класах, збірка бекенду, іменування PascalCase |

## Стек

Angular 22 + Angular Material · Node.js 26 + Fastify · TypeScript 6.0.3 ·
PostgreSQL 18 + TypeORM · JWT у httpOnly-cookie (`jose`) + argon2id · pg-boss ·
Cloudflare R2 · sharp · Anthropic Claude (`claude-opus-5`) · Caddy 2 ·
Docker Compose на Hetzner VPS · GitHub Actions

Бекенд збирається `tsc` у `dist/`: entity описані декораторами TypeORM, а Node їх не
трансформує ([ADR 0003](docs/adr/0003-three-layer-classes.md)). Шари всередині модуля —
`Controller → Service → Repository → Entity`. TypeScript пінується на 6.0.3: Angular 22
вимагає `>=6.0 <6.1`.

## Структура

```
apps/api/src/               api.ts (+ worker.ts згодом) · config, db, logger, errors
apps/api/src/modules/       auth · products · media · ai
apps/api/src/contracts/     zod-схеми запитів/відповідей, фронт бере з них типи
apps/api/db/                міграції, їх раннер, створення БД
apps/web/src/app/           auth · products — групування за фічею; фіча ділиться на
                            підфічі: auth/login · products/catalog · products/gallery
apps/web/src/environments/  конфіг фронту (@environments)
infra/caddy/                Caddyfile
docs/adr/                   архітектурні рішення
```

Dockerfile-и лежать поруч з кодом (`apps/api/Dockerfile`, `apps/web/Dockerfile`),
`docker-compose.yml` і `docker-compose.prod.yml` — у корені репозиторію.
Каркас каталогів вище закріплений у git файлами `.gitkeep` — це базова архітектура
проєкту. Нових каталогів поза ним не заводимо.

## Сервіси в Docker Compose

| Сервіс | Роль | dev | prod |
|---|---|---|---|
| `postgres` | Дані застосунку (згодом — і черга pg-boss) | 5432 | внутр. |
| `api` | Fastify: HTTP, авторизація, CRUD, постановка задач у чергу | 3000 (дебаг) | внутр. |
| `backup` | Разова задача: `pg_dump` перед міграціями, 14 останніх у `./backups` | — | автоматично |
| `migrate` | Разова задача: створення БД і міграції перед стартом `api` | автоматично | автоматично |
| `web` | `ng serve` у dev; у prod збирається в статику для Caddy | 4200 | — |
| `caddy` | TLS (Let's Encrypt), статика Angular, проксі `/api` | — | 80, 443 |
| `worker` | Той самий образ, інша команда: sharp, R2, Claude — зʼявиться з першою задачею | — | — |

У проді назовні відкриті лише 80/443 на Caddy; `postgres` і `api`
доступні тільки у внутрішній docker-мережі. У dev порти `api` і `web`
публікуються на хост, щоб браузер міг звертатися до них напряму.

## Конфігурація

Три рівні — вони не перетинаються і не замінюють один одного:

| Рівень | Де | Що містить | Хто бачить |
|---|---|---|---|
| Конфіг фронту | `apps/web/src/environments/*.ts` | `production`, `apiBaseUrl` | браузер — усе публічне |
| Константи бекенду | `apps/api/src/config.ts` — у коді | розміри зображень, ліміти, таймаути, TTL, параметри черги, модель AI | тільки сервер |
| Секрети й машинозалежне | змінні оточення контейнерів | `DATABASE_URL`, `JWT_SECRET`, `ADMIN_BOOTSTRAP_*`, ключі R2 і Anthropic, SMTP, домен | тільки процеси на VPS |

**Секрет не може жити на першому рівні:** Angular запікає `environment.ts` у бандл,
який завантажує браузер. `postgres`, `api` і `caddy` до Angular стосунку не мають і
читають лише змінні оточення — Docker Compose підхоплює їх з `.env` поруч з
`docker-compose.yml`. Сам `.env` не комітиться; у репозиторії лежить `.env.example`
з переліком змінних і командами для генерації секретів.

**Різниця між другим і третім рівнем — чи змінюється значення між машинами.**
`1568 px` для AI-кадру, `q80`, ліміт у 12 фото на товар, TTL сесії — однакові
скрізь, тож це типізовані константи в коді, під версійним контролем і видимі в
діффі, а не рядки в `.env`. У змінних оточення лишається те, що справді відрізняється
або не може потрапити в git.

Обидва серверні рівні сходяться в одному файлі — `apps/api/src/config.ts`: константи
оголошені прямо в ньому, а env-змінні читаються й валідуються zod-схемою, яка падає
на старті, якщо обов'язкової бракує.

**`environment.development.ts` не комітиться** — це локальний файл розробника.
`angular.json` посилається на нього через `fileReplacements`, тож без нього
`ng serve` не запуститься; заготовку створює entrypoint контейнера `web` при
першому старті, далі її можна правити під себе.

```ts
// apps/web/src/environments/environment.development.ts
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};
```

`environment.ts` (production) у git є — він не містить нічого локального.

## Локальний запуск

**Потрібно:** тільки Docker + Docker Compose v2. Node.js, npm і Angular CLI на
хості **не потрібні** — уся розробка відбувається всередині контейнерів. Працює
однаково на Ubuntu і macOS (Docker Desktop, colima, OrbStack).

```bash
git clone git@github.com:<owner>/mouse-springconsult.git
cd mouse-springconsult

cp .env.example .env
# замінити секрети в .env:
#   openssl rand -base64 48   → JWT_SECRET
#   openssl rand -base64 24   → POSTGRES_PASSWORD (і той самий пароль у DATABASE_URL)
#   openssl rand -base64 24   → ADMIN_BOOTSTRAP_PASSWORD
# Перелік і валідація змінних — apps/api/src/config.ts (падає на старті, якщо бракує)

docker compose up --build        # postgres → migrate → api → web
```

Порядок старту забезпечує сам Compose: `api` не підніметься, поки `postgres` не
стане здоровим, а разовий сервіс `migrate` не створить базу й не накотить міграції.

Після старту:

- UI — `http://localhost:4200` (`ng serve` усередині контейнера `web`)
- API — через той самий origin: `ng serve` проксує `/api` на контейнер `api`
  (`proxy.conf.json`), тому сесійна cookie працює так само, як у проді
- порт `3000` опубліковано лише для прямих запитів в обхід UI —
  health-check `http://localhost:3000/healthz`, `curl`, дебаг
- перший адмін — `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` з `.env`
- якщо порти `5432`, `3000` чи `4200` вже зайняті іншим проєктом, їх можна
  переназначити змінними `POSTGRES_HOST_PORT`, `API_HOST_PORT`, `WEB_HOST_PORT`

`api` перезапускається сам при зміні файлів (`node --watch`), `web` — через
`ng serve`. Код монтується в контейнер, а `node_modules` живуть в іменованому
volume: нативні модулі (`argon2`, згодом `sharp`) ставляться під Linux і не сумісні
з бінарниками, які поставилися б на macOS чи Windows. Саме тому `npm install` на
хості не просто зайвий — він зламав би контейнер, якби `node_modules` монтувалися
всередину.

## Розгортання на Hetzner VPS

Разова підготовка сервера:

```bash
# 1. DNS: A-запис mouse.springconsult.com.ua → IP сервера
# 2. На сервері
ssh deploy@<server-ip>
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo mkdir -p /opt/mouse && sudo chown deploy:deploy /opt/mouse
cd /opt/mouse

# 3. Покласти .env та docker-compose.prod.yml
#    APP_DOMAIN=mouse.springconsult.com.ua
#    ACME_EMAIL=<пошта для Let's Encrypt>
#    NODE_ENV=production
chmod 600 .env
```

Далі деплой виконує GitHub Actions при пуші в `main`:

1. `lint` + `typecheck` + `test` + `deps:check` — у тих самих образах, що й локально;
2. збірка образів `api` і `web`, публікація в GitHub Container Registry;
3. SSH на VPS → `docker compose pull` → `docker compose up -d`;
4. разовий сервіс `backup` знімає `pg_dump` у `/opt/mouse/backups`; якщо дамп не вдався,
   деплой зупиняється до першого DDL, а попередній `api` лишається на лінії;
5. разовий сервіс `migrate` створює базу (якщо треба) і застосовує міграції до старту `api`;
6. health-check `/healthz`; при невдачі — відкат на попередній тег образу.

Аварійний ручний деплой тим самим шляхом — коли GitHub Actions недоступні:

```bash
ssh deploy@<server-ip> 'cd /opt/mouse && docker compose pull && docker compose up -d'
```

Caddy отримує й автоматично оновлює сертифікат для `mouse.springconsult.com.ua` —
жодних ручних дій із TLS не потрібно.

## Основні команди

**Оточення**

```bash
docker compose up -d --build          # підняти все
docker compose down                   # зупинити (дані лишаються у volume)
docker compose down -v                # зупинити і стерти дані
docker compose logs -f api            # логи сервісу (api | web | migrate | postgres)
docker compose ps                     # стан контейнерів
docker compose exec postgres psql -U $POSTGRES_USER mouse_trading
```

**Залежності**

```bash
# Кожен застосунок має власний package.json і власний том node_modules,
# тому прапорець -w не потрібен — команда і так виконується в потрібному контейнері.
docker compose run --rm --no-deps api npm install fastify-plugin
docker compose run --rm --no-deps web npm install @angular/cdk
docker compose build api              # перезібрати образ після зміни package.json
```

**Якість**

```bash
docker compose run --rm --no-deps api npm run build       # tsc → apps/api/dist
docker compose run --rm --no-deps api npm run typecheck   # tsc --noEmit
docker compose run --rm --no-deps api npm run lint
docker compose run --rm api npm run test                  # tsc + node --test; потребує Postgres
docker compose run --rm --no-deps api npm run deps:check  # dependency-cruiser: межі шарів
docker compose run --rm --no-deps api npm run format
docker compose run --rm --no-deps web npm run lint        # ESLint, зокрема межі між фічами
docker compose run --rm --no-deps web npm run test        # vitest
docker compose run --rm --no-deps web npm run build       # прод-збірка + бюджети
```

`npm run test` — єдина команда без `--no-deps`: репозиторії й обмеження схеми
перевіряються на справжньому Postgres. База для тестів — двійник `DATABASE_URL`
із суфіксом `_test` (`mouse_trading_test`); окремої env-змінної немає, а створює
й мігрує її сам прогін тестів. Робочі дані вона не чіпає.

Бекенд збирається: entity описані декораторами TypeORM, а Node їх не трансформує
([ADR 0003](docs/adr/0003-three-layer-classes.md)). `test` і `dev` запускають `tsc`
самі, тож окремо викликати `build` перед ними не потрібно; решта команд працює з
`dist/`, який лишається від попередньої збірки. Стектрейси показують рядки `.ts` —
процес стартує з `--enable-source-maps`.

Ті самі команди виконує CI (`.github/workflows/ci.yml`) — у тих самих образах.

**База даних**

```bash
docker compose run --rm migrate                            # build + db:create + db:migrate
docker compose run --rm api npm run db:create              # ідемпотентно створює mouse_trading
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:migrate:revert      # відкотити останню
docker compose run --rm api npm run db:migrate:show
docker compose run --rm api npm run db:migrate:new -- add-product-seo  # + запис у migrations-list.ts
docker compose exec postgres psql -U $POSTGRES_USER mouse_trading
docker compose exec postgres pg_dump -U $POSTGRES_USER mouse_trading > backup.sql
```

Скрипти `db:*` виконують `dist/db/*.js`, тому на чистому клоні їм передує
`npm run build` — або одразу `docker compose run --rm migrate`, який збирає сам.

Базу створює не міграція, а `apps/api/db/init/0001-create-database.sql`:
`CREATE DATABASE` не виконується всередині транзакції і потребує зʼєднання з
іншою базою. У dev його проганяє контейнер `postgres` при першій ініціалізації
тому, на наявному сервері — `npm run db:create`.

**Angular CLI**

```bash
docker compose run --rm web npx ng generate component products/form/product-form
docker compose run --rm web npx ng build            # збірка статики для проду
```

**Черга** — зʼявиться разом із сервісом `worker` і першою задачею для pg-boss.

## Бекап

- **PostgreSQL** — щоденний `pg_dump` за розкладом, копія поза сервером.
- **Cloudflare R2** — версіонування бакета; оригінали фото не перезаписуються.
- **`.env`** — зберігати в менеджері паролів; у git не потрапляє ніколи.

## Ліцензія

Приватний проєкт. Усі права застережено.
