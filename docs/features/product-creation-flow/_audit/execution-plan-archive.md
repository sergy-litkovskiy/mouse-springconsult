---
status: Archived
owner: "Serhii"
updated_at: "2026-09-21"
---

# Архів плану виконання — product-creation-flow

Порядок, інструменти й обґрунтування закритих задач. Виїхало з
[execution-plan.md](../execution-plan.md), коли поставку 1 і бекенд поставки 2 було
закрито, а план перестав описувати роботу і став описувати історію. Живі задачі
лишились там; тут — те, з чим звірятись, коли схожа задача трапиться знову: чому цю
вели `goal`, а не `tdd`, де конвеєр упирався в Gate 2 і які умови `/goal` спрацювали
дослівно.

Що з задач вийшло на ділі — у [хроніці трекера](tracker-journal.md).

## Перш ніж почати (на момент старту поставки 1)

1. **T24 — першою.** Рішення людини, коду не чекає; веди його паралельно з T06, щоб
   можлива нова колонка з рішення №5 потрапила в story T26 до старту поставки 2.
2. **R2 для T06 готовий** (перевірено на живому бакеті). Коли T06 додаватиме рядки
   `R2_*` у `.env.example`, коментарі мають назвати дві пастки:
   - `R2_ACCESS_KEY_ID` і `R2_SECRET_ACCESS_KEY` — S3-пара зі сторінки токена (id токена
     і SHA-256 його значення), а не саме значення `cfut_…`;
   - `R2_PUBLIC_BASE_URL` — публічна адреса бакета (`r2.dev` чи власний домен) без імені
     бакета, а не S3 endpoint `*.r2.cloudflarestorage.com`, який приймає лише підписані
     запити.
3. **Ключ Anthropic до T27.** Потрібен окремий ключ у Claude Console зі spend limit на
   workspace; його значення йде в `ANTHROPIC_API_KEY` у `.env`. Підписка для `worker` не
   підходить. `.env.example` оновлює сама T27.

## Поставка 1 — картка й галерея

Порядок — **спершу бекенд, потім фронт.** Доопрацювання каталогу з запиту 2026-09-16
(T34–T37) вбудоване в ці самі дві доріжки. T34 іде в бекенд, бо блокує і T35, і T22.
T36 → T35 → T37 ідуть у веб-доріжці перед T22: вони правлять ті самі файли
`product-catalog.*`, і краще закрити дрібні правки до великої. Причина не в графі залежностей: T18 можна
почати вже зараз. Але `pw` для T20–T22 потребує живих маршрутів галереї, і T21 без
T14 перевіряти нема на чому. Задачі сховища (T06→T07→T08) стоять першими, бо на них
чекають T12, T14, T16 і T17.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 1 | T06 | Конфіг R2 і парні ліміти | `goal` | — | — | `envSchema`, compose, `Caddyfile`: поведінки під unit-тест немає. «Падає без змінної» перевір руками по одній змінній до кроку Б |
| 2 | T07 | `ImageStorage.ts` | `goal` | смоук на живому бакеті | — | Тонкий адаптер SDK: тест на двійнику S3 перевірив би двійник. DoD прямо вимагає живий бакет |
| 3 | T08 | `MediaService.ts` | `tdd·r` | `+обв'язка`: `media/index.ts` | — | Перевірка сигнатури вмісту є межею безпеки з ADR 0004. Story вже перелічує п'ять тест-кейсів. Крок 3 **переносить** `InvalidFile`, `FileTooLarge` і `StorageUnavailable` з `products/ProductErrors.ts` у `media/MediaErrors.ts` (аудит 2026-09-16). Перенесення тестів — робота RED: після нього implementer `*.spec.ts` не чіпає (Gate 2). Заглушка `MediaErrors.ts` поруч зі старими класами після RED — очікуваний тимчасовий дубль. На паузі `--review-tests` перевір, що випадки **перенесено**, а не скопійовано: у `ProductErrors.spec.ts` їх більше немає. Після GREEN трьох класів немає ні в `products/ProductErrors.ts`, ні в `products/index.ts`. Простіша альтернатива — перенести класи окремим комітом `refactor(media)` до `/tdd T08`, щоб RED покривав лише `MediaService` |
| 4 | T11 | Маршрути картки | `scaf` | — | — | Обв'язка: контролер, `sessionGuard`, DTO, composition root |
| 5 | T12 | Знести `product_images.url` | `scaf` | — | — | Міграція разом із мапінгом адреси; зачіпає й `apps/web`, тож іде **до** веб-задач, щоб не правити ті самі файли двічі |
| 6 | T34 | Фільтр готовності в `api` | `tdd` | — | — | Поведінка під тест на реальній базі: AC-29 і таблиця узгодженості SQL-виразу з `isReady` (AC-30). Правки `openapi.yaml` і `PRD.md §5` (кроки 6–7) агенти `/tdd` не зроблять, бо правлять лише код. Внеси їх руками до кроку Б. Критичним шляхом задача не є: немає ні сесії, ні грошей, ні транзакції |
| 7 | T15 | Головний кадр | `tdd` | `+обв'язка`: `PUT …/main` | — | XS: `image_not_found`, ідемпотентний `PUT` |
| 8 | T14 | Приймання кадру | `tdd` | `+обв'язка`: multipart, `POST …/images`, composition root; ліміт 10/11 МБ через `caddy` | `cpr` | Поведінка в `ProductService.addImage`. QG-1 «жодного рядка без об'єкта» — інваріант цілісності того самого класу, що й у T16, а приймання файлу — межа з ADR 0004 |
| 9 | T16 | Видалення кадру | `tdd·r` | `+обв'язка`: `DELETE …/images/:imageId`; смоук з недосяжним R2 | `cpr` | Порядок «об'єкт → рядок» тримає цілісність даних |
| 10 | T17 | Видалення картки | `tdd·r` | `+обв'язка`: `DELETE /:productId`, composition root | `cpr` | Каскад і пакетне прибирання, незворотна дія |
| 11 | T18 | Клієнт API на фронті | `tdd` | — | — | Приклад із плейбука. Контроль рантаймових імпортів з `*.contract.ts` |
| 12 | T36 | Варіанти «Всі / Так / Ні» | `tdd` | `pw` | — | XS, лише підписи `mat-option`. Тест через `MatSelectHarness` на текст і порядок. Значення не змінюються, тому збережені адреси мають відкриватись як раніше. Крок 3 (`PRD.md §5`) — руками |
| 13 | T35 | Фільтр «Картка готова» | `tdd` | `pw` | — | Правка наявних `product-catalog.*` за взірцем `publishedProm`, нових файлів немає. `products-api.ts` не змінюється. Крок 5 (`PRD.md §5`) — руками |
| 14 | T37 | Ширина фільтрів | `goal` | `pw` на 1280 і 360 px | — | Верстка без поведінки під unit-тест, DoD вимірюваний (див. умову `/goal` нижче). Обрізані мітки й перенос помилки ціни оцінюєш сам на знімках до кроку Б |
| 14a | T38 | Порожня картка | `tdd·r` | міграція окремим комітом до `/tdd` | — | Додано 2026-09-17: без порожньої картки діалог T20 не створює нову (кадр вантажиться лише в наявну, поля до першого кадру вимкнені). Предикат готовності отримує заголовки: доменний інваріант. Правки `openapi.yaml`, `PRD.md`, ADR 0009 — руками |
| 15 | T20 | Форма картки | `scaf` | `pw` | — | Нова підфіча `products/form/` з `.html`/`.css`. Zoneless-тести на AC-13 і AC-20 — у DoD, їх перевіряє `feature-ship` |
| 16 | T21 | Секція галереї | `scaf` | `pw` із дроселем мережі | — | Нові файли секції. QG-2 (прев'ю до відповіді) видно лише на живому стеку |
| 17 | T22 | Каталог | `tdd` | `pw` | — | Правка наявного `product-catalog` з наявним spec; 4 комбінації фільтрів. Бейдж бере `isReady` з рядка списку, тож без T34 RED впаде не на тій причині |
| 18 | T23 | Приймання поставки 1 | `plan` | `pw` | — | `verification`: протокол у `_audit/`, дефекти оформлюються новими задачами. Чекає й на T37 і перевіряє AC-29…AC-34 доопрацювання каталогу |

**Паралельність.** Після T12 доріжки `apps/api` (T34, T15, T14, T16, T17) і `apps/web`
(T18, T36, T35, T37, T20, T21, T22) записують різні файли. Виняток: T35 чекає на T34, тож веб-доріжка
не дійде до T35 раніше, ніж бекенд закриє T34. Workflow тут можливий, але лише за
явного рішення: він коштує приблизно 15× токенів, а `tracker.md` оновлюється після
обох доріжок. Для одного розробника послідовний порядок дешевший.

## Поставка 1 — UI-доопрацювання

Запит 2026-09-17. Задачі треба закрити **до старту поставки 2**: T25 чекає на T42 і T43.
T24 рішення, тож його можна вести паралельно. T40 → T41 → T42 ідуть по черзі, бо правлять
ті самі файли (`styles.css`, `product-form.css`). T43 торкається `product-catalog.*` і
нового компонента, тож може йти паралельно з цим ланцюжком. Щоб не розв'язувати конфлікти
в `product-catalog.css`, краще почати її після T40.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 19a | T40 | Компактні фільтри й мітки | `goal` | `pw` на 1280 і 360 px | — | Верстка без поведінки під unit-тест, DoD вимірюваний (висота поля 45–48 px). Назви токенів `--mat-form-field-*` звір із документацією Material до старту `/goal`, бо цикл писатиме їх з пам'яті. Сірість мітки у фокусі та з помилкою оцінюєш сам на знімках |
| 19b | T41 | Висота ціни у формі | `goal` | `pw`: з хибною ціною і без неї | — | Одна правка вирівнювання з вимірюваним DoD (різниця висоти ≤ 1 px). Спершу виміряй висоту трьох полів, щоб підтвердити причину |
| 19c | T42 | Кольори бейджа | `goal` | `pw`: обчислені кольори в каталозі й у формі | — | Перенесення CSS у `styles.css`; наявні тести на класи `readiness*` мають лишитися зеленими без правок |
| 19d | T43 | Перегляд фото | `scaf` | `pw` | — | Новий компонент `products/gallery/image-viewer.*` з `.html`/`.css`, тож `tdd` тут упреться в Gate 2. Задача змінює рішення T22 (лічильник відкривав форму), тож наявний тест каталогу переписується, а не «лагодиться». Кроки 6 (`PRD.md`, `sad.md`) — руками |

**Друга хвиля (запит 2026-09-17).** T44 → T45 правлять ті самі `product-form.*`, тож ідуть
по черзі. Старт поставки 2 вони не тримають.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 19e | T44 | Лінії в діалозі картки | `goal` | `pw`: обчислені кольори ліній, діалог підтвердження без них | — | Два правила CSS без поведінки під unit-тест |
| 19f | T45 | Результат збереження | `tdd` | `pw`: успіх зі сповіщенням і помилка з `route` 422 | — | Поведінка під тест: закриття з `true`, текст сповіщення, помилка в рядку дій. Нових файлів немає, тож `tdd` не впреться в Gate 2. RED переписує тести, що перевіряли стару поведінку: тест T39 про бейдж після збереження, а також тести AC-12 і AC-07, які чекали «Збережено.» у діалозі. Це зміна вимоги, а не «лагодження» тестів, тож Gate 1 покаже `pass` на 3 менше за базову лінію, і це очікувано. Стилі сповіщення й помилки (кроки 3–4) тести не бачать, тож їх робить окремий коміт `style(web)` до кроку Б. Крок 7 (`PRD.md`, примітка в T39) — руками |

**Третя хвиля: опис Prom у HTML (запит 2026-09-18).** Задачі треба закрити **до старту
поставки 2**: T25 чекає на T49. Першою йде T46: запит суперечить правилу «Не додаємо
WYSIWYG-редактор» з кореневого `CLAUDE.md` і plain text з `ai/CLAUDE.md`, а без рішення
виконавці T47–T49 упруться в чинні правила. Після T46 доріжки T47 (`apps/api`) і T48
(`apps/web`) записують різні файли, тож можуть іти в будь-якому порядку. T49 чекає на обидві:
вона кладе кнопку в компонент T48 і імпортує перелік тегів з константи T47.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 19g | T46 | Опис Prom як HTML | `plan` | — | — | `decision`: ADR 0016, перелік тегів, бібліотека редактора, чистка в браузері, наявні plain-text рядки, ліміт 8000, правка `CLAUDE.md`. Бібліотеку редактора звір з офіційною документацією на сумісність з Angular 22 і zoneless, бо з пам'яті версії не видно |
| 19h | T47 | Чистка HTML в `api` | `tdd·r` | — | — | Серверна чистка є межею безпеки від збереженого XSS, тож тести варто переглянути до GREEN. Перенесення `cleanDescription` з `db/prom-xlsx.ts` у `products` і винесення переліку в `contracts/` — окремим комітом `refactor(products)` до `/tdd`, щоб RED покривав лише поведінку `ProductService`. На паузі `--review-tests` перевір три вектори XSS (`script`, `onerror`, `javascript:`). Правки `openapi.yaml` і `PRD.md` — руками |
| 19i | T48 | Редактор опису Prom | `scaf` | пакет редактора окремим комітом до кроку А; `pw` на 1280 і 360 px | — | Новий компонент `products/form/prom-description-editor.*` з `.html`/`.css`, тож `tdd` тут упреться в Gate 2. Пакет ставиться в образ `web`, а не на хості. Розмір бандла сторінки картки виміряй до і після. `PRD.md` — руками |
| 19j | T49 | Кнопка «Почистити html» | `tdd` | бібліотека чистки (якщо T46 її обрала) окремим комітом до `/tdd`; `pw` | — | Правка наявного компонента T48 і нова функція `.ts`, тож `tdd` не впреться в Gate 2. Тести повторюють спільний набір прикладів з T47, бо результат кнопки має збігатися з відповіддю сервера. `PRD.md` — руками |

## Поставка 2 — модель

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 0 | T24 | Закрити відкриті TBD | `plan` | — | — | `decision`: вікно ліміту, статус при частковій відмові `both`, `discriminatedUnion`. **Робити першою** — див. «Перш ніж почати» |
| 20 | T25 | Черга і `worker` | `goal` | `docker compose logs -f worker`, зупинка worker не валить api | — | Інфраструктура: pg-boss, другий composition root, сервіс у compose |
| 21 | T26 | Таблиці підготовки | `scaf` | down/up міграції | `cpr` | Плагін знає точки реєстрації (`ENTITIES` у dependency-cruiser, `createDataSource` в обох roots). UNIQUE `idempotency_key` захищає від подвійної оплати |
| 22 | T27 | Адаптер Anthropic | `goal` **у головній сесії після скіла `claude-api`** | один живий виклик з реальним ключем | — | Правильність тут — це актуальна форма API: `output_config.format`, `web_search_20260209`, adaptive thinking. Агенти `/tdd` не мають ні `Skill`, ні `WebFetch` і писали б з пам'яті. Тести на sharp і межу в 3 кадри входять в умову `/goal` |
| 23 | T31 | Вартість картки | `tdd` | — | — | XS: сума одним запитом, нулі замість `null` |
| 24 | T28 | Сервіс підготовки | `tdd·r` | — | `cpr` | Серцевина фічі: AC-28 (одна транзакція), модель не пише в `products`, облік `usage` |
| 25 | T29 | Маршрути запусків | `tdd·r` | `POST` не чекає на модель (pino) | `cpr` | Гейти AC-06/AC-27, ідемпотентність через індекс, ліміт частоти — усе це прямі гроші |
| 26 | T30 | Прийняття пропозицій | `tdd·r` | — | `cpr` | AC-11 і AC-26 — доменні інваріанти, які пишуть у `products` |
| 27 | T32 | Фронт підготовки | `tdd·r` | `pw`, зокрема reload (AC-28) | — | Правка наявної форми й клієнта; полінг, disabled-стани, зупинка таймера. Якщо RED вимагатиме нового компонента з `.html` — зупинити й перевести на `scaf` |
| 25a | T51 | Повтор після відмови | `tdd·r` | міграція окремим комітом до `/tdd`; down/up | `cpr` | Додано 2026-09-19 з RED T29. Частковий UNIQUE `WHERE status <> 'failed'` — інваріант проти подвійної оплати, тож тести переглянути до GREEN |
| 25b | T52 | Завислі запуски | `tdd·r` | `+обв'язка`: обхід у `worker.ts`; смоук на живому `worker` | `cpr` | Додано 2026-09-19 з рев'ю T28. `UPDATE` з guard статусу проти обробника, що саме завершує запуск, — інваріант цілісності, тож тести переглянути до GREEN |
| 26a | T53 | Непідтверджені пропозиції в картці | `tdd` | — | — | Додано 2026-09-20 з рев'ю T30: `openapi.yaml` має `pendingSuggestions` обов'язковим полем картки, а `api` його не віддає. Правка наявних `products.contract.ts`, `ProductService` і `ProductController`, нових файлів немає. Задача ще й звужує контракт: три поля картки переїжджають зі спільної схеми `Product` у схему відповіді читання, бо каталогом вони не віддаються й віддаватись не мають (рішення T31). Правки `openapi.yaml` і `PRD.md §5` (кроки 4–5) агенти `/tdd` не зроблять — внеси руками до кроку Б |

T26 і T27 після T25 незалежні, тож їхній порядок можна поміняти.

## Готові умови `/goal`

Умова має три частини: вимірюваний стан, вивід раннера й обмеження. `node --test` друкує
`ℹ fail N` і назви `describe`, а не імена файлів, тож на конкретний тест посилаємось
назвою `describe`, яку умова й задає. Обмеження `git diff --stat -- '*.spec.ts'` не
пускає цикл «лагодити» наявні тести під свій код.

T07, T25 і T27 додають npm-пакети, а `node_modules` живуть в образі контейнера. Без
перебудови образу цикл упреться в «Cannot find module» і може спробувати `npm install`
на хості, тож порядок установки — частина умови.

```
/goal docs/features/product-creation-flow/tasks/configure-r2-and-body-limits.md: every Checklist item is done, `docker compose run --rm api npm run test` prints "ℹ fail 0", `docker compose run --rm --no-deps api npm run typecheck` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/add-image-storage-adapter.md: every Checklist item is done, `docker compose run --rm --no-deps api npm run deps:check` exits 0, `docker compose run --rm api npm run test` prints "ℹ fail 0", `git diff --stat -- '*.spec.ts'` prints nothing; install packages only with `docker compose run --rm --no-deps api npm install <pkg>` followed by `docker compose build api`, never on the host; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/add-queue-and-worker.md: every Checklist item is done, `docker compose logs worker` contains the line "worker subscribed" logged by src/worker.ts after pg-boss subscribes, `docker compose run --rm --no-deps api npm run deps:check` exits 0, `docker compose run --rm api npm run test` prints "ℹ fail 0", `git diff --stat -- '*.spec.ts'` prints nothing; install packages only with `docker compose run --rm --no-deps api npm install <pkg>` followed by `docker compose build api`, never on the host; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/add-anthropic-adapter.md: every Checklist item is done, `docker compose run --rm api npm run test` prints "ℹ fail 0" and lists passing describes "frame limit" (at most 3 frames per request) and "frame optimization" (smaller byte size after sharp), `docker compose run --rm --no-deps api npm run deps:check` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; install packages only with `docker compose run --rm --no-deps api npm install <pkg>` followed by `docker compose build api`, never on the host; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/resize-catalog-filter-fields.md: every Checklist item is done, playwright-cli screenshots of /products at 1280 and 360 px width are saved and at 360 px `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/compact-catalog-filter-fields.md: every Checklist item is done, playwright-cli screenshots of /products at 1280 and 360 px width are saved, every `.filters .mat-mdc-text-field-wrapper` has `getBoundingClientRect().height` between 44.8 and 47.6, at 360 px `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/fix-product-form-field-sizing.md: every Checklist item is done, in the open card dialog at 1280 px the `.mat-mdc-text-field-wrapper` heights of the price, category and condition fields differ by at most 1 px both with and without the price error shown, playwright-cli screenshots at 1280 and 360 px are saved, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/unify-readiness-badge-colors.md: every Checklist item is done, `rg -n "readiness--" apps/web/src/app --glob '*.css'` prints nothing, the computed `background-color` and `color` of `[data-testid="readiness"]` are equal in the catalogue row and in the open card dialog for both a ready and a not-ready card (checked with playwright-cli), `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

Хвіст `or stop after N turns` ненадійний, тож межу витрат став окремо.
