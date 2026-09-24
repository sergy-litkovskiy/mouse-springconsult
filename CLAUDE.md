# CLAUDE.md

Адмінка для підготовки карток комісійних товарів (Prom / OLX).
Домен: `mouse.springconsult.com.ua`. Обсяг: 50–100 товарів/міс, один-два адміни.

## Стек

Версії й залежності — у `apps/*/package.json`, `docker-compose*.yml` і Dockerfile.
З коду не виводиться:

- **TypeScript 6.0.3** — жорсткий пін: Angular 22 вимагає `>=6.0 <6.1`.
- UI — Angular 22 standalone, signals, **zoneless**.
- `apps/api` збирається `tsc` у `dist/` через декоратори TypeORM (див. `apps/api/CLAUDE.md`).
- Хостинг — Hetzner VPS.

## Структура репозиторію

```
apps/api/src/                                   api.ts, worker.ts + технічні сервіси
                                                (config, db, logger, queue, errors)
apps/api/src/modules/{auth,products,media,ai}   бізнес-модулі
apps/api/src/contracts/                         zod-схеми й константи контракту (@contracts)
apps/api/db/                                    міграції, раннер, створення БД (зокрема тестової)
apps/web/src/app/{auth,products}/               фічі Angular; підфічі — auth/login,
                                                products/{catalog,form,gallery}
apps/web/src/environments/                      конфіг фронту (@environments)
infra/caddy/                                    Caddyfile
docs/adr/                                       рішення рівня проєкту
docs/features/<slug>/                           SDLC-артефакти фічі
```

Каркас фіксований. Каталогів поза ним — `shared/`, `core/`, `utils/`, папок за типом
коду — не заводимо; новий каталог з'являється лише разом з першим файлом у ньому.
`pricing` живе всередині `ai` (той самий Claude, інший метод сервісу), модуль
`marketplace` — разом з першим файлом інтеграції з Prom/OLX.

## Правила залежностей (ОБОВ'ЯЗКОВІ)

```
src/api.ts · src/worker.ts · db/*.ts  composition root: тільки тут new Repository()
      │
      ▼
modules/<feature>/
   *Controller.ts ─► *Service.ts ─► *Repository.ts ─► Entity (@Entity)
      │                                                  typeorm · pg
      ├─► modules/<other>/index.ts                       лише public API, без deep import
      │
      ▼
src/config.ts · db.ts · logger.ts · queue.ts · errors.ts         не знають про modules
src/contracts/                                                   чисті zod-схеми, без залежностей
```

Вертикаль — дозволений напрямок залежності. Зворотна стрілка є помилкою архітектури, а
не стильовою дрібницею. Правила 1–15 — підписи до цієї схеми; вони лежать у CLAUDE.md
застосунків (див. «Правила модулів»).

Правила перевіряються автоматично — окремою командою на застосунок, бо `node_modules`
у контейнерів різні (точні команди — skill `mouse-commands`). PR з порушенням не мержиться.

## Конвенції

- **Мова.** Код, ідентифікатори й коміти — англійською. Тексти UI та згенерований
  AI контент — українською. Артефакти SDLC у `docs/` (idea-brief, PRD, SAD, ADR) —
  тіло українською; англійською лишається їхній каркас: заголовки секцій, ключі
  frontmatter, статуси, імена файлів ADR і згадки ідентифікаторів коду.
- **Іменування файлів.** Ім'я файлу = ім'я того, що він експортує. Тести —
  `*.spec.ts` поруч з тим, що тестують. Регістр і винятки — у `apps/api/CLAUDE.md`
  (PascalCase) та `apps/web/CLAUDE.md` (kebab-case без суфіксів).
- **Експорти.** Модуль бекенду має `index.ts` з явним public API — це єдина точка,
  через яку його бачать інші модулі. Інших barrel-файлів не робимо; на фронті
  `index.ts` не потрібен зовсім.
- **TypeScript.** `strict: true`, `noUncheckedIndexedAccess`, без `any`,
  без `export default` (крім Angular-конфігів). Без `enum` і `namespace` — замість
  них union чи `const`-обʼєкт. ESM; в імпортах на бекенді пишемо розширення **`.ts`**.
- **Коментарі.** Лише там, де є нюанс: чому саме так, обхід чужої поведінки,
  неочевидний інваріант. Те, що видно з коду й імен, коментарем не переказуємо.
- **Валідація.** Кожен вхідний payload валідується zod-схемою на межі — у `*Controller.ts`.
  Схеми живуть у `apps/api/src/contracts/`: бекенд валідує ними вхідні дані, фронт
  імпортує з них типи через alias `@contracts/*`. Окремого npm-пакета під це немає.
- **Контракти: схеми окремо, константи окремо.** `*.contract.ts` — zod-схеми й
  виведені типи; фронт бере звідти **тільки** `import type`. Константи контракту
  (`error-codes.ts`, `*-limits.ts`) залежностей не мають — їх фронт імпортує в
  рантаймі. Один рантайм-імпорт із zod-файлу тягне zod у бандл браузера (+55 КБ gzip).
- **Помилки.** Базовий клас `AppError` — у `src/errors.ts`; доменні помилки
  (`ProductNotFound`, `InvalidCredentials`) оголошує той модуль, якому вони належать.
  HTTP-мапінг — один error-handler, зареєстрований у `src/api.ts`. Стек-трейси
  назовні не віддаємо. Повідомлення в API — англійською: текст для користувача
  формує фронт за полем `code` (`src/contracts/error.contract.ts`).
- **Гроші.** Ціни — `decimal(12,2)` у БД і десятковий рядок у коді (`"2499.00"`), від
  драйвера до браузера без перетворень: ні `transformer` на колонці, ні конвертера в
  репозиторії, ні копійок. Ніяких `float`. Формат для показу (`Intl.NumberFormat`) — на клієнті.
- **Час.** `timestamptz`, UTC у БД, форматування — на клієнті.
- **Конфігурація — три рівні, не плутаємо.**
  1. `@environments/environment` — бандл фронту. Усе в ньому публічне.
  2. `src/config.ts` — константи бекенду в коді: розміри й якість зображень, ліміти
     завантаження, черга, таймаути, TTL сесії, ідентифікатор моделі. Змінюються комітом.
  3. `process.env` — **тільки** секрети й машинозалежне: `DATABASE_URL`, `JWT_SECRET`,
     `ADMIN_BOOTSTRAP_*`, креденшели R2, `ANTHROPIC_API_KEY`, SMTP, домен. Валідуються
     zod-схемою в `src/config.ts`, яка падає на старті. Зразок — `.env.example`;
     `.env` у git не потрапляє.

  Критерій: якщо значення однакове на всіх машинах — це константа, а не env-змінна.
  Секрети у файлах Angular не з'являються ніколи.

## Правила модулів

Правила конкретного застосунку чи модуля лежать у вкладених `CLAUDE.md` —
`apps/api`, `apps/web`, `modules/auth`, `modules/ai` — і підвантажуються, щойно
Claude торкається файлів поруч.

## Команди

Повний довідник команд (docker compose, build/test/lint, міграції БД, Angular
CLI) — у skill `mouse-commands`, підвантажується під час запуску команд.

## Чого НЕ робимо

- Не додаємо Redis/RabbitMQ — черга живе в Postgres, поки навантаження це дозволяє.
- Не витягуємо модулі в окремі сервіси. Це модульний моноліт; межі тримаємо в коді.
- Не зберігаємо зображення в БД. На **читання** браузер бере кадр з R2 сам, за
  публічною адресою, без проксі через API
  ([ADR 0007](docs/features/product-creation-flow/adr/0007-serve-images-from-a-public-bucket.md)).
  На **запис** кадр іде **через** `api`, який перевіряє файл до потрапляння у сховище
  ([ADR 0004](docs/features/product-creation-flow/adr/0004-validate-uploads-in-api-before-r2.md)).
- Не робимо публічний фронт/каталог для покупців. Це внутрішня адмінка.
- Не пишемо інтеграцію з Prom/OLX зараз.
- Не додаємо WYSIWYG-редактор, окрім опису для Prom: це HTML, його редагує міні-редактор
  Tiptap з режимом сирого HTML, а `api` чистить його перед записом
  ([ADR 0016](docs/features/product-creation-flow/adr/0016-store-the-prom-description-as-html.md)).
  Решта текстів — `textarea`, plain text.
- Не запускаємо нічого на хості й не монтуємо `node_modules` з хоста — деталі
  в «Командах».

## Git

- Conventional Commits: `type(scope): subject`. Scope — модуль (`products`, `ai`),
  застосунок (`web`, `api`) або slug фічі для `docs`.
- У `main` не комітимо. Гілка — `<type>-<short-name>`, для story — `feat-t54-...`.
- `push`, `reset --hard`, `--force` не виконуємо — лише друкуємо команду для людини.
- Файли додаємо поіменно, не `git add -A`. Не комітимо `.env` та секретні ключі.

## Pull requests

- Платформа — GitHub, `gh` CLI. PR відкриваємо одразу після першого чистого коміту,
  як `--draft`, поки робота не завершена; `gh pr ready` — коли завершена.
- `gh pr create` вимагає запушеної гілки, а `push` робить людина (див. «Git»):
  друкуємо `git push -u origin <branch>`, чекаємо підтвердження, тоді створюємо PR.
- Заголовок — у форматі коміта, англійською: `type(scope): subject`.
- Тіло — англійською, за розділами `.github/pull_request_template.md`; передаємо
  через `--body-file`: з `--body` шаблон `gh` не підставляє.

## Рев'ю

Пріоритети P0/P1/P2 і правила проходу — спільні з Codex і Copilot, тож живуть в
одному файлі:

@AGENTS.md
