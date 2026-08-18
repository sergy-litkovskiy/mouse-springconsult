# CLAUDE.md

Адмінка для підготовки карток комісійних товарів (Prom / OLX).
Домен: `mouse.springconsult.com.ua`. Обсяг: 50–100 товарів/міс, один-два адміни.

## Стек

| Шар | Технологія |
|---|---|
| UI | Angular 22 (standalone, signals, zoneless) + Angular Material |
| API | Node.js 26 (ESM, Fastify). Типи стрипаються нативно — бекенд **не збирається** |
| TypeScript | **6.0.3** — жорсткий пін: Angular 22 вимагає `>=6.0 <6.1`, а latest уже 7.x |
| БД | PostgreSQL 18 |
| Черга | pg-boss (поверх PostgreSQL, без Redis) |
| Файли | Cloudflare R2 (S3 API, `@aws-sdk/client-s3`) |
| Зображення | sharp |
| AI | Anthropic Claude API — `claude-opus-5` |
| Проксі/TLS | Caddy 2 |
| Хостинг | Hetzner VPS, Docker Compose |
| CI/CD | GitHub Actions |

## Структура репозиторію

```
apps/api/src/                                   api.ts, worker.ts + технічні сервіси
                                                (config, db, logger, queue, errors)
apps/api/src/modules/{auth,products,media,ai}   бізнес-модулі
apps/api/src/contracts/                         zod-схеми запитів/відповідей (@contracts)
apps/api/db/migrations/                         міграції схеми
apps/web/                                       корінь Angular workspace (angular.json)
apps/web/src/app/{auth,products}/               фічі Angular
apps/web/src/environments/                      конфіг фронту (@environments)
infra/caddy/                                    Caddyfile
docs/adr/                                       архітектурні рішення
```

Каталог з'являється разом з першим файлом у ньому. Порожніх «місць про запас» немає:
`pricing` живе всередині `ai` (той самий Claude, інший use-case), модуль синхронізації
з маркетплейсами буде створено тоді, коли до нього дійде черга.

> **Це цільова структура, а не поточний стан.** У репозиторії зараз лише каталоги-
> заготовки, документи і `apps/web/src/environments/`. Файли, на які посилаються
> правила нижче — `src/api.ts`, `src/worker.ts`, `src/config.ts`, `src/contracts/`,
> `angular.json`, `package.json`, `docker-compose.yml`, `Caddyfile` — з'являться
> разом з першим кодом. Документи кажуть, **куди що класти**, а не що вже написано.

## Правила залежностей (ОБОВ'ЯЗКОВІ)

### Backend — межі між модулями

```
modules/*  →  src/*.ts (технічні сервіси)
```

1. Технічні сервіси (`config.ts`, `db.ts`, `logger.ts`, `queue.ts`, `errors.ts`)
   лежать просто в `src/` і не імпортують нічого з `modules/` — вони не знають про бізнес.
   Окремий каталог-шар для них заводимо, коли їх стане помітно більше.
   R2-клієнт і SMTP спільними не є: це адаптери портів, оголошених `media` і `auth`,
   і жити вони мають усередині своїх модулів.
2. Модуль звертається до іншого модуля **тільки** через його `index.ts` (public API).
   Deep import (`modules/products/product-repository.ts` з `modules/media/...`) —
   заборонено. Шину подій не вводимо, поки прямі виклики справляються.
3. Циклів між модулями бути не може. Якщо потрібен цикл — виносимо спільний контракт
   у `src/contracts/` або перевертаємо залежність через порт.

### Backend — межі всередині модуля

Шари існують, але виражені **суфіксами файлів**, а не каталогами: модуль — це одна
папка, і поки в ній менше десятка файлів, вкладеність лише заважає читати.

```
*.routes.ts  →  *.use-case.ts  →  *.port.ts / доменні типи
                                        ↑
                         *.repository.ts / *.adapter.ts (реалізації)
```

4. Доменні типи й порти (`*.port.ts`) не мають I/O: без `pg`, `fastify`, `@aws-sdk`,
   `@anthropic-ai/sdk`.
5. `*.use-case.ts` залежить від портів, а не від реалізацій. Імпорт `*.repository.ts`
   або `*.adapter.ts` з use-case — помилка.
6. `*.routes.ts` — валідація вхідних даних, авторизація, мапінг у DTO з `@contracts`.
   Бізнес-логіки в роутах немає.
7. Реалізації інстанціює тільки composition root — `src/api.ts` (HTTP-процес) і
   `src/worker.ts` (обробник черги).
8. Коли в модулі стає тісно (умовно понад 10 файлів) — розкладаємо його на підпапки.
   Не раніше.

### Frontend

Дотримуємось [офіційного style guide Angular](https://angular.dev/style-guide).

9. Групуємо **за фічею**, а не за типом коду. Каталогів `components/`, `services/`,
   `directives/`, `pipes/`, `utils/`, `ui/`, `data-access/` не створюємо — це прямий
   анти-патерн з гайду.
10. Каталогів `core/` і `shared/` немає. Синглтони — це `providedIn: 'root'` у файлі
    поруч з фічею, якій вони належать; NgModule-епоха, що породила `core/`, закінчилась.
11. Фічі не імпортують одна одну. Коли щось знадобилось двом фічам — виносимо у файл
    з конкретним іменем на рівні `app/` (напр. `app/confirm-dialog.ts`), а не в `shared/`.
12. Типи запитів/відповідей беруться з `@contracts`. Дублювати інтерфейси DTO у web —
    заборонено.
13. Конфіг фронту — `@environments/environment`. Каталог лежить у застосунку
    (`apps/web/src/environments/`), як і вимагає `ng generate environments`;
    спільного на весь монорепо не буває — `fileReplacements` є механізмом білдера
    Angular, а `apps/api` не збирається взагалі й читає `process.env`.
    Angular підміняє файл при збірці
    (`fileReplacements` в `angular.json`): `environment.ts` — production,
    `environment.development.ts` — dev. Тримаємо там мінімум (`production`,
    `apiBaseUrl`); секретів у ньому не буває — все, що потрапляє в бандл, публічне.
    `environment.development.ts` у git не потрапляє, тому на чистому клоні його
    створюють вручну — зразок у README. `apiBaseUrl` дорівнює `/api` в обох
    оточеннях: у dev `ng serve` проксує `/api` на контейнер `api`
    (`proxy.conf.json`), тож origin один і CORS не потрібен ніде.

Правила перевіряються автоматично: `docker compose run --rm api npm run deps:check`
(dependency-cruiser по glob-ах імен файлів для api, ESLint-межі для web).
PR з порушенням не мержиться.

## Конвенції

- **Мова.** Код, ідентифікатори, коміти, ADR — англійською. Тексти UI та
  згенерований AI контент — українською.
- **Іменування файлів.** kebab-case, ім'я файлу = ім'я класу в ньому.
  Angular (style guide 20+): **без** суфіксів `.component.ts` / `.service.ts` —
  клас `ProductCatalog` лежить у `product-catalog.ts`, `ProductsApi` — у
  `products-api.ts`, `authGuard` — у `auth-guard.ts`. Шаблон і стилі — поруч:
  `product-catalog.html`, `product-catalog.css`. Тести — `*.spec.ts`.
  Backend, навпаки, суфікси має, бо саме вони несуть межі шарів:
  `.use-case.ts`, `.port.ts`, `.repository.ts`, `.adapter.ts`, `.routes.ts`.
- **Експорти.** Модуль бекенду має `index.ts` з явним public API — це єдина точка,
  через яку його бачать інші модулі. Інших barrel-файлів не робимо; на фронті
  `index.ts` не потрібен зовсім.
- **TypeScript.** `strict: true`, `noUncheckedIndexedAccess`, без `any`,
  без `export default` (крім Angular-конфігів). ESM; в імпортах на бекенді пишемо
  розширення **`.ts`** — Node виконує файли напряму, стираючи типи, а не компілює їх.
- **Erasable syntax (бекенд).** Оскільки типи стираються, а не компілюються, синтаксис
  має бути стираним: **без** `enum` (замість нього union або `const` об'єкт), **без**
  parameter properties у конструкторах (`constructor(private x: X)`), **без**
  `namespace`. Вмикається прапорцем `erasableSyntaxOnly` — порушення ловить `tsc`.
  На фронті обмеження не діє: Angular компілюється своїм білдером.
- **Валідація.** Кожен вхідний payload валідується zod-схемою на межі — у `*.routes.ts`.
  Схеми живуть у `apps/api/src/contracts/`: бекенд валідує ними вхідні дані, фронт
  імпортує з них типи через alias `@contracts/*`. Окремого npm-пакета під це немає —
  контракти належать API, який їх і виконує.
- **Помилки.** Базовий клас `AppError` — у `src/errors.ts`; доменні помилки
  (`ProductNotFound`, `InvalidCredentials`) оголошує той модуль, якому вони належать.
  HTTP-мапінг — один error-handler, зареєстрований у `src/api.ts`. Стек-трейси
  назовні не віддаємо.
- **БД.** Snake_case в SQL, camelCase у TS. Зміни схеми — тільки міграцією в
  `apps/api/db/migrations`. Ручний DDL на проді заборонено.
- **Гроші.** Ціни — `numeric(12,2)` у БД, цілі копійки в коді. Ніяких `float`.
- **Час.** `timestamptz`, UTC у БД, форматування — на клієнті.
- **Логи.** pino, JSON, structured. У логи не потрапляють: паролі, токени сесій,
  ключі R2/Anthropic, повні тіла зображень.
- **Конфігурація — три рівні, не плутаємо.**
  1. `@environments/environment` — бандл фронту. Усе в ньому публічне за визначенням.
  2. `src/config.ts` — **константи бекенду прямо в коді**: розміри зображень і якість
     JPEG, ліміти завантаження, параметри черги, таймаути, TTL сесії, ідентифікатор
     моделі. Типізовані, з коментарями, змінюються через коміт.
  3. `process.env` — **тільки** секрети й машинозалежне: `DATABASE_URL`, креденшели
     R2, `ANTHROPIC_API_KEY`, `SESSION_SECRET`, SMTP, домен. Читаються й валідуються
     zod-схемою в тому ж `src/config.ts`, яка падає на старті, якщо чогось бракує.

  Критерій: якщо значення однакове на всіх машинах — це константа, а не env-змінна.
  Env, яка ніколи не змінюється, лише ховає число від типізації й від рев'ю.
  Ключ Anthropic, креденшели R2, пароль БД і `SESSION_SECRET` у файлах Angular не
  з'являються ніколи.
- **Коміти.** Conventional Commits: `feat(products): ...`, `fix(media): ...`.

## Правила роботи з AI-модулем

- Модель — `claude-opus-5`, константа в `src/config.ts`. Не env-змінна: заміна моделі
  змінює якість генерації, формат відповіді й собівартість картки, тому має проходити
  через коміт і рев'ю, а не через рестарт контейнера з іншим значенням.
- **Оптимізація перед відправкою.** Зображення до AI йде через sharp:
  довша сторона ≤ 1568 px, JPEG q80, sRGB, EXIF вирізано (константи в `src/config.ts`). Вартість зображення
  ≈ `(ширина × висота) / 750` токенів — більший розмір не дає кращого розпізнавання.
- На розпізнавання відправляємо максимум 3 кадри (константа), а не всю галерею. Додаткові фото завантажуються **без** AI.
- **Без зайвого форматування.** Відповідь запитуємо через structured outputs
  (`output_config.format` з JSON-схемою) і зберігаємо як plain text. Markdown,
  емодзі, обгортки «Ось ваш опис:» — не генеруємо і не парсимо.
- Пошук ринкових цін — server tool `web_search_20260209` з `user_location` = UA;
  повертаємо діапазон + посилання на джерела, ціну не вигадуємо.
- Adaptive thinking (`thinking: {type: "adaptive"}`) увімкнено; `budget_tokens`
  не використовуємо — параметр видалено на цій моделі.
- Кожен виклик логує `usage` (input/output/cache токени) в `ai_generations` —
  без цього неможливо рахувати собівартість картки.
- Виклики AI виконуються **тільки у worker** через чергу. HTTP-запит не чекає на AI.

## Команди

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

# Разові команди — через контейнер
docker compose run --rm api npm run typecheck   # tsc --noEmit, збірки немає
docker compose run --rm api npm run lint
docker compose run --rm api npm run test        # node --test, *.spec.ts поруч з кодом
docker compose run --rm api npm run deps:check
docker compose run --rm api npm run format

# Залежності — після зміни package.json перезібрати образ
docker compose run --rm api npm install <pkg> -w apps/api
docker compose build api

# База
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:migrate:new -- <name>
docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB

# Angular CLI
docker compose run --rm web npx ng generate component products/product-catalog
```

Чому так жорстко: `sharp` і `argon2` — нативні модулі. Встановлені на macOS, вони
не запустяться в Linux-контейнері, тому `node_modules` живуть в іменованому volume,
а не приїжджають з хоста. `npm install` на хості не просто зайвий — він створив би
каталог, який ламає контейнер, щойно його змонтують всередину.

Makefile навмисно не заводимо: `docker compose` уже є інтерфейсом, а обгортка над
ним лише додає рівень, який доводиться тримати в голові. Деплой виконує GitHub
Actions при пуші в `main` — вручну він не запускається.

## Чого НЕ робимо

- Не додаємо Redis/RabbitMQ — черга живе в Postgres, поки навантаження це дозволяє.
- Не витягуємо модулі в окремі сервіси. Це модульний моноліт; межі тримаємо в коді.
- Не зберігаємо зображення в БД і не проксуємо їх через API — тільки R2 + presigned URL.
- Не робимо публічний фронт/каталог для покупців. Це внутрішня адмінка.
- Не пишемо інтеграцію з Prom/OLX зараз. Модуль `marketplace` створюється разом з
  першим файлом інтеграції — порожньої папки під нього не тримаємо.
- Не додаємо WYSIWYG-редактор. Тексти редагуються в `textarea` як plain text.
- Не заводимо каталог «про запас». Папка з'являється разом з першим файлом у ній;
  порожні шари й `.gitkeep`-скелети — це шум, який видає структуру за роботу.
- Не запускаємо нічого на хості. Немає «швидкого способу» зробити `npm run` локально:
  оточення одне — те, що в контейнері, і воно ж їде на прод.
- Не монтуємо `node_modules` з хоста в контейнер — нативні бінарники несумісні.
