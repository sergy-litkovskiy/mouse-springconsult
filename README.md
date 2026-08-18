# mouse-springconsult

Адмінка для підготовки, зберігання та редагування карток комісійних товарів, які
продаються на **Prom** і **OLX**. Завантажене фото автоматично розпізнається,
для товару генеруються SEO-опис, SEO-тексти та діапазон ринкових цін по Україні.

Домен: `mouse.springconsult.com.ua` · Обсяг: 50–100 товарів на місяць

> **Стан репозиторію: скелет.**
>
> *Є зараз:* документи (`SPEC.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `README.md`, ADR),
> каркас каталогів під модулі й `apps/web/src/environments/`.
>
> *Ще немає:* коду, `package.json`, `tsconfig.json`, `angular.json`, Dockerfile-ів,
> `docker-compose.yml`, `Caddyfile`, GitHub Actions.
>
> Отже структура, команди й шляхи нижче — **цільовий стан**. Зокрема
> `apps/api/src/config.ts`, на який посилається розділ «Конфігурація», буде створено
> разом з першим кодом бекенду; поки що перелік серверних змінних існує лише тут.

## Документація

| Файл | Про що |
|---|---|
| [SPEC.md](SPEC.md) | Цілі, межі, технічні рішення, критерії приймання |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Схема розгортання, модулі, dependency rule |
| [CLAUDE.md](CLAUDE.md) | Правила залежностей, конвенції, команди |
| [docs/adr/](docs/adr/) | Архітектурні рішення та їх обґрунтування |

## Стек

Angular 22 + Angular Material · Node.js 26 + Fastify · TypeScript 6.0.3 ·
PostgreSQL 18 · pg-boss · Cloudflare R2 · sharp · Anthropic Claude (`claude-opus-5`) ·
Caddy 2 · Docker Compose на Hetzner VPS · GitHub Actions

Бекенд не збирається — Node 26 виконує `.ts` напряму, `tsc` лишається перевіркою.
TypeScript пінується на 6.0.3: Angular 22 вимагає `>=6.0 <6.1`.

## Структура

```
apps/api/src/               api.ts · worker.ts + config, db, logger, queue, errors
apps/api/src/modules/       auth · products · media · ai
apps/api/src/contracts/     zod-схеми запитів/відповідей, фронт бере з них типи
apps/api/db/migrations/     міграції схеми
apps/web/src/app/           auth · products — групування за фічею
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
| `postgres` | Дані застосунку + черга pg-boss | 5432 | внутр. |
| `api` | Fastify: HTTP, авторизація, CRUD, постановка задач у чергу | 3000 (дебаг) | внутр. |
| `worker` | Той самий образ, `APP_ROLE=worker`: sharp, R2, Claude, пошук цін | — | — |
| `web` | `ng serve` у dev; у prod збирається в статику для Caddy | 4200 | — |
| `migrate` | Разова задача: міграції перед стартом `api` | on-demand | on-demand |
| `caddy` | TLS (Let's Encrypt), статика Angular, проксі `/api` | — | 80, 443 |

У проді назовні відкриті лише 80/443 на Caddy; `postgres`, `api` і `worker`
доступні тільки у внутрішній docker-мережі. У dev порти `api` і `web`
публікуються на хост, щоб браузер міг звертатися до них напряму.

## Конфігурація

Три рівні — вони не перетинаються і не замінюють один одного:

| Рівень | Де | Що містить | Хто бачить |
|---|---|---|---|
| Конфіг фронту | `apps/web/src/environments/*.ts` | `production`, `apiBaseUrl` | браузер — усе публічне |
| Константи бекенду | `apps/api/src/config.ts` — у коді | розміри зображень, ліміти, таймаути, TTL, параметри черги, модель AI | тільки сервер |
| Секрети й машинозалежне | змінні оточення контейнерів | `DATABASE_URL`, ключі R2 і Anthropic, `SESSION_SECRET`, SMTP, домен | тільки процеси на VPS |

**Секрет не може жити на першому рівні:** Angular запікає `environment.ts` у бандл,
який завантажує браузер. `postgres`, `api`, `worker` і `caddy` до Angular стосунку не
мають і читають лише змінні оточення — Docker Compose підхоплює їх з `.env` поруч з
`docker-compose.yml`; файл не комітиться і шаблону в репозиторії не має.

**Різниця між другим і третім рівнем — чи змінюється значення між машинами.**
`1568 px` для AI-кадру, `q80`, ліміт у 12 фото на товар, TTL сесії — однакові
скрізь, тож це типізовані константи в коді, під версійним контролем і видимі в
діффі, а не рядки в `.env`. У змінних оточення лишається те, що справді відрізняється
або не може потрапити в git.

Обидва серверні рівні сходяться в одному файлі — `apps/api/src/config.ts`: константи
оголошені прямо в ньому, а env-змінні читаються й валідуються zod-схемою, яка падає
на старті, якщо обов'язкової бракує.

**`environment.development.ts` не комітиться** — у кожного свій `apiBaseUrl`.
Після клонування його треба створити, інакше `ng serve` впаде: `angular.json`
посилається на нього через `fileReplacements`.

```ts
// apps/web/src/environments/environment.development.ts
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};
```

`environment.ts` (production) у git є — він не містить нічого локального.

## Локальний запуск

**Потрібно:** тільки Docker + Docker Compose v2, бакет Cloudflare R2 і ключ
Anthropic API. Node.js, npm і Angular CLI на хості **не потрібні** — уся розробка
відбувається всередині контейнерів.

```bash
git clone git@github.com:<owner>/mouse-springconsult.git
cd mouse-springconsult

# створити .env поруч з docker-compose.yml — DATABASE_URL, POSTGRES_*, R2_*,
# ANTHROPIC_API_KEY, SESSION_SECRET (openssl rand -base64 48), SMTP_*,
# ADMIN_BOOTSTRAP_EMAIL. Перелік і валідація — apps/api/src/config.ts

docker compose up --build        # postgres, api, worker, web у watch-режимі
```

Після старту:

- UI — `http://localhost:4200` (`ng serve` усередині контейнера `web`)
- API — через той самий origin: `ng serve` проксує `/api` на контейнер `api`
  (`proxy.conf.json`), тому сесійна cookie працює так само, як у проді
- порт `3000` опубліковано лише для прямих запитів у обхід UI —
  health-check `http://localhost:3000/healthz`, `curl`, дебаг
- перший адмін створюється за `ADMIN_BOOTSTRAP_EMAIL`; пароль задається через
  посилання «Відновити доступ»

`api` і `worker` перезапускаються самі при зміні файлів (`node --watch`), `web` —
через `ng serve`. Код монтується в контейнер, а `node_modules` живуть в іменованому
volume: нативні модулі (`sharp`, `argon2`) збираються під Linux і не сумісні з
бінарниками, які поставилися б на macOS чи Windows. Саме тому `npm install` на хості
не просто зайвий — він зламав би контейнер, якби `node_modules` монтувалися всередину.

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
4. разовий сервіс `migrate` застосовує міграції до старту `api`;
5. health-check `/healthz`; при невдачі — відкат на попередній тег образу.

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
docker compose logs -f api            # логи сервісу (api | worker | caddy | postgres)
docker compose ps                     # стан контейнерів
docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB
docker compose restart worker         # перезапустити воркер
```

**Залежності**

```bash
docker compose run --rm api npm install
docker compose run --rm api npm install fastify-plugin -w apps/api
docker compose run --rm web npm install @angular/cdk -w apps/web
docker compose build api              # перезібрати образ після зміни package.json
```

**Якість**

```bash
docker compose run --rm api npm run typecheck     # tsc --noEmit
docker compose run --rm api npm run lint
docker compose run --rm api npm run test          # node --test, *.spec.ts поруч з кодом
docker compose run --rm api npm run deps:check    # dependency-cruiser: межі модулів api
docker compose run --rm api npm run format
docker compose run --rm web npm run lint          # ESLint, зокрема межі між фічами
docker compose run --rm web npm run test
```

**База даних**

```bash
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:migrate:new -- add-product-seo
docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```

**Angular CLI**

```bash
docker compose run --rm web npx ng generate component products/product-catalog
docker compose run --rm web npx ng build            # збірка статики для проду
```

**Черга**

```bash
docker compose logs -f worker
docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB \
  -c "select name, state, count(*) from pgboss.job group by 1,2;"
```

## Бекап

- **PostgreSQL** — щоденний `pg_dump` за розкладом, копія поза сервером.
- **Cloudflare R2** — версіонування бакета; оригінали фото не перезаписуються.
- **`.env`** — зберігати в менеджері паролів; у git не потрапляє ніколи.

## Ліцензія

Приватний проєкт. Усі права застережено.
