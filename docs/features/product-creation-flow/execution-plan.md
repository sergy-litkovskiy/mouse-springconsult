# План виконання — product-creation-flow

Складено 2026-09-15 за [tracker.md](tasks/tracker.md), доповнено 2026-09-16 задачами T34–T37
і залежністю T03 → T08 (закрито 9 з 37 задач) і за правилами
[agentic-tools-playbook.md](../../../agentic-tools-playbook.md), §2 і §5.3. Статус живе
лише в tracker, цей файл описує тільки порядок і інструменти.

## Як читати

Кожна задача проходить два кроки (плейбук §1.3):

```
гілка → Крок А: виконавець → [між кроками] → Крок Б: /mouse-trading:feature-ship <ID> → [після] → push + PR (ти)
```

| Позначка | Крок А (виконавець) | Коли |
|---|---|---|
| `tdd` | `/tdd <ID>` | поведінку можна покрити тестом, а story править **наявні** файли або створює лише `.ts` |
| `tdd·r` | `/tdd <ID> --review-tests` | те саме, але помилка в тестах коштує дорого: інваріант, гроші, межа безпеки |
| `scaf` | `/mouse-trading:feature-scaffold`, обмежений story-файлом | обв'язка: маршрути, міграція, нові файли Angular (`.html`/`.css`) |
| `goal` | `/goal …` з умовою «do not commit and do not edit tracker.md» | конфіг чи інфраструктура з бінарним DoD |
| `plan` | інтерактивна сесія в Plan mode | `decision` / `verification`; `feature-ship` не потрібен |

Чому **нову Angular-підфічу веде `scaf`, а не `tdd`.** `tdd-implementer` нових файлів не
створює, а `tdd-test-writer` підкладає лише сигнатурні заглушки `.ts`. Для компонента з
новими `.html`/`.css` конвеєр упреться в Gate 2.

**Між кроками:** `pw` означає перевірку AC через `playwright-cli` на живому стеку, до
`feature-ship`, бо той ставить `Done`. Гейт Playwright ще не спроєктований, тож поки це
ручний прохід за AC story.
**Після кроку Б:** `cpr` означає `critical-path-review`, обов'язково перед мержем; `cpr?` —
бажано.

## Перш ніж почати

1. ~~**Розсинхрон статусів.**~~ Вирівняно 2026-09-15: frontmatter T06 і T11 → `Todo`, як у tracker.
2. **Cloudflare R2 до T06.** Бакет, API-токен і публічний домен створюєш руками в
   панелі Cloudflare, а значення вписуєш у порожні `R2_*` у локальному `.env`.
   Без них T06 не пройде DoD «падає без змінної», а T07 не перевірить повторне
   видалення на живому бакеті. Рядки в `.env.example` додає сама T06, це пункт її
   Checklist.
3. **Ключ Anthropic до T27.** Потрібен окремий ключ у Claude Console зі spend limit на
   workspace; його значення йде в `ANTHROPIC_API_KEY` у `.env`. Підписка для `worker` не
   підходить. `.env.example` оновлює сама T27.
4. **Ralph не використовуємо** (плейбук §2): неархівовані `ralph.sh` і
   `.claude/skills/ralph-prep/` у цьому плані не беруть участі.

## Поставка 1 — картка й галерея

Порядок — **спершу бекенд, потім фронт.** Доопрацювання каталогу з запиту 2026-09-16
(T34–T37) вбудоване в ці самі дві доріжки. T34 іде в бекенд, бо блокує і T35, і T22.
T36 → T35 → T37 ідуть у веб-доріжці перед T22: вони правлять ті самі файли
`product-catalog.*`, і краще закрити дрібні правки до великої. Причина не в графі залежностей: T18 можна
почати вже зараз. Але `pw` для T20–T22 потребує живих маршрутів галереї, і T21 без
T14 перевіряти нема на чому. Задачі сховища (T06→T07→T08) стоять першими, бо в них
найбільший зовнішній ризик: креденшели, CORS, публічний домен.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 1 | T06 | Конфіг R2 і парні ліміти | `goal` | — | — | `envSchema`, compose, `Caddyfile`: поведінки під unit-тест немає. «Падає без змінної» перевір руками по одній змінній до кроку Б |
| 2 | T07 | `ImageStorage.ts` | `goal` | смоук на живому бакеті | — | Тонкий адаптер SDK: тест на двійнику S3 перевірив би двійник. DoD прямо вимагає живий бакет |
| 3 | T08 | `MediaService.ts` | `tdd·r` | — | — | Перевірка сигнатури вмісту є межею безпеки з ADR 0004. Story вже перелічує п'ять тест-кейсів. Крок 3 **переносить** `InvalidFile`, `FileTooLarge` і `StorageUnavailable` з `products/ProductErrors.ts` у `media/MediaErrors.ts` (аудит 2026-09-16), а не пише їх заново. Перевір, що RED не створив дублікатів |
| 4 | T11 | Маршрути картки | `scaf` | — | — | Обв'язка: контролер, `sessionGuard`, DTO, composition root |
| 5 | T12 | Знести `product_images.url` | `scaf` | — | — | Міграція разом із мапінгом адреси; зачіпає й `apps/web`, тож іде **до** веб-задач, щоб не правити ті самі файли двічі |
| 6 | T34 | Фільтр готовності в `api` | `tdd` | — | — | Поведінка під тест на реальній базі: AC-29 і таблиця узгодженості SQL-виразу з `isReady` (AC-30). Правки `openapi.yaml` і `PRD.md §5` (кроки 6–7) агенти `/tdd` не зроблять, бо правлять лише код. Внеси їх руками до кроку Б. Критичним шляхом задача не є: немає ні сесії, ні грошей, ні транзакції |
| 7 | T15 | Головний кадр | `tdd` | — | — | XS: `image_not_found`, ідемпотентний `PUT` |
| 8 | T14 | Приймання кадру | `tdd` | ліміт 10/11 МБ через `caddy` | `cpr?` | Поведінка в `ProductService.addImage`. Реєстрацію multipart і маршрут `/tdd` перелічить у звіті як пункти Checklist без поведінки: їх доробляєш окремим комітом до `feature-ship`. QG-1: жодного рядка без об'єкта |
| 9 | T16 | Видалення кадру | `tdd·r` | смоук з недосяжним R2 | `cpr` | Порядок «об'єкт → рядок» тримає цілісність даних |
| 10 | T17 | Видалення картки | `tdd·r` | — | `cpr` | Каскад і пакетне прибирання, незворотна дія |
| 11 | T18 | Клієнт API на фронті | `tdd` | — | — | Приклад із плейбука. Контроль рантаймових імпортів з `*.contract.ts` |
| 12 | T36 | Варіанти «Всі / Так / Ні» | `tdd` | `pw` | — | XS, лише підписи `mat-option`. Тест через `MatSelectHarness` на текст і порядок. Значення не змінюються, тому збережені адреси мають відкриватись як раніше. Крок 3 (`PRD.md §5`) — руками |
| 13 | T35 | Фільтр «Картка готова» | `tdd` | `pw` | — | Правка наявних `product-catalog.*` за взірцем `publishedProm`, нових файлів немає. `products-api.ts` не змінюється. Крок 5 (`PRD.md §5`) — руками |
| 14 | T37 | Ширина фільтрів | `goal` | `pw` на 1280 і 360 px | — | Верстка без поведінки під unit-тест, DoD вимірюваний (див. умову `/goal` нижче). Обрізані мітки й перенос помилки ціни оцінюєш сам на знімках до кроку Б |
| 15 | T20 | Форма картки | `scaf` | `pw` | — | Нова підфіча `products/form/` з `.html`/`.css`. Zoneless-тести на AC-13 і AC-20 — у DoD, їх перевіряє `feature-ship` |
| 16 | T21 | Секція галереї | `scaf` | `pw` із дроселем мережі | — | Нові файли секції. QG-2 (прев'ю до відповіді) видно лише на живому стеку |
| 17 | T22 | Каталог | `tdd` | `pw` | — | Правка наявного `product-catalog` з наявним spec; 4 комбінації фільтрів. Бейдж бере `isReady` з рядка списку, тож без T34 RED впаде не на тій причині |
| 18 | T23 | Приймання поставки 1 | `plan` | `pw` | — | `verification`: протокол у `_audit/`, дефекти оформлюються новими задачами |

**Паралельність.** Після T12 доріжки `apps/api` (T34, T15, T14, T16, T17) і `apps/web`
(T18, T36, T35, T37, T20, T21, T22) записують різні файли. Виняток: T35 чекає на T34, тож веб-доріжка
не дійде до T35 раніше, ніж бекенд закриє T34. Workflow тут можливий, але лише за
явного рішення: він коштує приблизно 15× токенів, а `tracker.md` оновлюється після
обох доріжок. Для одного розробника послідовний порядок дешевший.

## Поставка 2 — модель

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 19 | T24 | Закрити відкриті TBD | `plan` | — | — | `decision`: вікно ліміту, статус при частковій відмові `both`, `discriminatedUnion`. **Можна будь-коли раніше**, але обов'язково до T26: рішення №5 може додати колонку |
| 20 | T25 | Черга і `worker` | `goal` | `docker compose logs -f worker`, зупинка worker не валить api | — | Інфраструктура: pg-boss, другий composition root, сервіс у compose |
| 21 | T26 | Таблиці підготовки | `scaf` | down/up міграції | `cpr?` | Плагін знає точки реєстрації (`ENTITIES` у dependency-cruiser, `createDataSource` в обох roots). UNIQUE `idempotency_key` захищає від подвійної оплати |
| 22 | T27 | Адаптер Anthropic | `goal` **у головній сесії після скіла `claude-api`** | один живий виклик з реальним ключем | — | Правильність тут — це актуальна форма API: `output_config.format`, `web_search_20260209`, adaptive thinking. Агенти `/tdd` не мають ні `Skill`, ні `WebFetch` і писали б з пам'яті. Тести на sharp і межу в 3 кадри входять в умову `/goal` |
| 23 | T31 | Вартість картки | `tdd` | — | — | XS: сума одним запитом, нулі замість `null` |
| 24 | T28 | Сервіс підготовки | `tdd·r` | — | `cpr` | Серцевина фічі: AC-28 (одна транзакція), модель не пише в `products`, облік `usage` |
| 25 | T29 | Маршрути запусків | `tdd·r` | `POST` не чекає на модель (pino) | `cpr` | Гейти AC-06/AC-27, ідемпотентність через індекс, ліміт частоти — усе це прямі гроші |
| 26 | T30 | Прийняття пропозицій | `tdd·r` | — | `cpr` | AC-11 і AC-26 — доменні інваріанти, які пишуть у `products` |
| 27 | T32 | Фронт підготовки | `tdd·r` | `pw`, зокрема reload (AC-28) | — | Правка наявної форми й клієнта; полінг, disabled-стани, зупинка таймера. Якщо RED вимагатиме нового компонента з `.html` — зупинити й перевести на `scaf` |
| 28 | T33 | Приймання поставки 2 | `plan` | `pw` | — | Живий ключ, недоступна модель, протокол у `_audit/` |

T26 і T27 після T25 незалежні, тож їхній порядок можна поміняти.

## Готові умови `/goal`

Умова має три частини: вимірюваний стан, вивід раннера й обмеження. `node --test` друкує
`ℹ fail N`, а не імена файлів.

```
/goal docs/features/product-creation-flow/tasks/configure-r2-and-body-limits.md: every Checklist item is done, `docker compose run --rm api npm run test` prints "ℹ fail 0", `docker compose run --rm --no-deps api npm run typecheck` exits 0; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/add-image-storage-adapter.md: every Checklist item is done, `docker compose run --rm --no-deps api npm run deps:check` exits 0, `docker compose run --rm api npm run test` prints "ℹ fail 0"; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/add-queue-and-worker.md: every Checklist item is done, `docker compose logs worker` shows the handler subscribed, `docker compose run --rm --no-deps api npm run deps:check` exits 0, `docker compose run --rm api npm run test` prints "ℹ fail 0"; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/add-anthropic-adapter.md: every Checklist item is done, a test proves at most 3 frames per request and a smaller byte size after sharp, `docker compose run --rm api npm run test` prints "ℹ fail 0", `docker compose run --rm --no-deps api npm run deps:check` exits 0; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/resize-catalog-filter-fields.md: every Checklist item is done, playwright-cli screenshots of /products at 1280 and 360 px width are saved and at 360 px `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0; do not commit and do not edit tracker.md
```

Хвіст `or stop after N turns` ненадійний, тож межу витрат став окремо.

## Зведення за інструментами

| Інструмент | Задачі |
|---|---|
| `/tdd` | T34, T15, T14, T18, T36, T35, T22, T31 |
| `/tdd --review-tests` | T08, T16, T17, T28, T29, T30, T32 |
| `feature-scaffold` | T11, T12, T20, T21, T26 |
| `/goal` | T06, T07, T37, T25, T27 (з `claude-api`) |
| Plan mode | T24, T23, T33 |
| `playwright-cli` | T36, T35, T37, T20, T21, T22, T32, T23, T33 |
| `critical-path-review` | обов'язково: T16, T17, T28, T29, T30 · бажано: T14, T26 |
| `feature-ship` | усі, крім T23, T24, T33 |
| Ручні правки документів до кроку Б | T34 (`openapi.yaml`, `PRD.md`), T35, T36, T37 (`PRD.md`) |
