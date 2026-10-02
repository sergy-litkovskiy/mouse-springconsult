# План виконання — product-creation-flow

Складено за графом [tracker.md](tasks/tracker.md) і правилами
`TMP-DOCS/agentic-tools-playbook.md` (локальний файл, не в git), §2 і §5.3. Статус живе
лише в tracker, цей файл описує тільки порядок і інструменти.

Порядок, інструменти й обґрунтування закритих задач — в
[архіві](_audit/execution-plan-archive.md); там же умови `/goal`, які спрацювали
дослівно, і їх варто перечитати перед тим, як писати нову.

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
`+обв'язка` означає пункти Checklist без поведінки (маршрут, `index.ts`, composition root):
`/tdd` їх не робить — test-writer пише лише специфікацію й заглушки, implementer нових
файлів не створює. Дописуєш їх окремим комітом до `feature-ship`. Тесту на «401 без
сесії» для такого маршруту агенти не напишуть, тож перевір його смоуком.
**Після кроку Б:** `cpr` означає `critical-path-review`, обов'язково перед мержем.

## Що лишилось

### Поставка 3 — відкриті задачі (T66, T68, T70, T72–T76, T78–T87)

Закриті T56–T65, T67, T69, T71 і T77 переїхали в [архів](_audit/execution-plan-archive.md). Відкриті — запити
2026-09-23 (T68–T74), 2026-09-25 (T75, T76), 2026-09-30 (T78–T82) і UX-аудит 2026-10-02 (T83–T87). Граф лишає T68, T70, T72, T75, T76 і T78
незалежними, а ланцюжки має лише для AI-кнопок поля (T72 → T73 → T74 → T66), каталогу (T78 → T79 → T80) і
зачистки коду (T81, T82). Задачі правлять одні й ті самі файли, тож порядок задають файли, а не граф. Доріжки:

- **каталог** (`product-catalog.*`): T78 → T79 → T80 → T87. Спершу іконки комірки (`goal`), потім каркас сторінки
  зі скролом лише таблиці (`tdd`: він прибирає верхній пагінатор T57 і чіпає `app-layout.*`), далі
  висота тулбара, шапки й фільтрів (`goal`). T80 стоїть і за T75: висоту шапки міряють з уже зменшеним шрифтом.
  Останньою йде T87: колонка назви OLX стає другим рядком і не збиває вимірів T80;
- **форма** (`product-form.*`, `suggestion-field.*`): T70 → T83 → T74 → T84 → T66. T70 — дрібна правка шаблону, тож іде
  першою, за нею T83 (запитання перед закриттям картки з правками). T84 додає «Відхилити» в `app-suggestion-field`
  уже з позначкою стану з T74. T66 стоїть останньою, бо її спінер замінює обидві кнопки запуску з T73 у вже
  переробленому T74 і T84 компоненті. T68 править лише `prom-description-editor.*`, тож іде паралельно з будь-чим;
- **`ai`** (`AnthropicAdapter.ts`, `PreparationService.ts`, `PreparationRunService.ts`): T72 — остання з доріжки
  T67 → T71 → T72, вона править вхід моделі й ключ ідемпотентності поля. З доріжкою форми сходиться на T73:
  кнопкам потрібен `mode` з T72;
- **зачистка коду** (T81 — `web`, T82 — `api`): останні в поставці, бо правлять коментарі й назви
  тестів у файлах майже всіх відкритих задач, і кожна ранніша правка дала б конфлікт при ребейзі. T81 чекає на T66, T68, T70, T74, T80,
  T83, T84, T85 і T87, T82 — на T74. Якщо власник схоче зачистку раніше, ребра можна зняти ціною ручного злиття.
  T76 і T86 — відкриті `web`-задачі поза цим ланцюжком: T76 змінює одне правило CSS, T86 — сторінку входу, і номерів
  задач у цих файлах немає, тож ребер до T81 вони не мають;
- **T75, T76, T85, T86** — поза доріжками, тож їх можна взяти будь-коли. `product-gallery.css` з T76 і `styles.css` з
  T75 не чіпає жодна інша відкрита задача. T85 міняє функції ціни в `product-catalog-query.ts` і текст підказки в
  `product-catalog.*` та `product-form.*`; правки точкові, тож ребер до доріжок не має, але T81 її чекає. T86 править
  лише сторінку входу.

Один виконавець іде таблицею згори вниз; дві доріжки можна вести паралельно лише в різних
гілках, і тоді друга ребейзиться на першу.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 1 | T68 | Опис Prom після відкриття | `tdd` | **до** кроку А — `pw` «Зберегти» й нове відкриття (крок 1 story; порожній редактор уже відтворено 2026-10-02); після — `pw` повторно | — | Дефект, гіпотеза — гонка `writeValue` із завантаженням Tiptap. Якщо `pw` її не підтвердив, задача йде в `plan`, а не в `/tdd`: тест на непідтверджену причину зафіксує не той дефект. `PRD.md §5` — руками |
| 2 | T70 | ID з копіюванням | `tdd` | `pw`: `navigator.clipboard.readText()` | — | Правка наявних `product-form.*`, нових файлів немає. `Clipboard` з `@angular/cdk`, пакет уже є. `PRD.md §5` — руками |
| 3 | T83 | Незбережені правки картки | `tdd` | `pw`: правка назви, тоді Esc, клік повз діалог і «Скасувати»; без правки — закриття без запитання; нічого не зберігати | — | Правка наявних `product-form.*`, нових файлів немає; `ConfirmDialog` уже є. «Є правки» — порівняння з `card()`, а не `dirty`: RED має покрити пройдене без змін поле ключових слів, яке `dirty` позначає хибно. `PRD.md §5` — руками |
| 4 | T72 | Режими `improve` і `prompt` | `tdd` | `pw` — два платні виклики `field`, ≈ $0,01 разом; суму назвати до й після | — | Промпти тестуються на двійнику адаптера: майданчик у тексті, відсутність `web_search`. `mode` у хеші й читання старої задачі без `mode` — під тест. Кнопок ще немає, тож `pw` шле `POST` з `mode` напряму. `openapi.yaml`, `sad.md` (S7, сценарій 10) і `PRD.md` (US-10, AC-21, AC-22, AC-66, AC-67) — руками |
| 5 | T73 | Три кнопки AI | `tdd` | `pw` — знімок tonal-кнопок, тултіпи, один платний виклик ≈ $0,005 | — | Правка наявних `suggestion-field.*` і `product-form.*`. Наявність tonal у `matIconButton` і назви іконок звірити з документацією до старту, бо агенти писатимуть їх з пам'яті. Тести на старі `aria-label` RED переписує, а не видаляє. `PRD.md §5` — руками |
| 6 | T74 | Остання пропозиція на поле | `tdd·r` | `pw` без платних викликів | — | Змінюється контракт читання картки, і від нього залежить AC-11: тести переглянути до GREEN, бо звірка має поводитись як раніше. Тести T53 і T55 RED переписує на `latestSuggestions`, а не видаляє. Не `cpr`: ні сесій, ні грошей. `openapi.yaml`, `sad.md` сценарій 9, `PRD.md` і excerpt-и закритих T53 і T55 — руками, і після них gate-check теки `tasks/` |
| 7 | T84 | Відхилити пропозицію | `tdd` | `pw` без платних викликів: відхилити дві висячі пропозиції на картці «Методика музичного виховання в школі», перевідкрити | — | Правка наявних `suggestion-field.*` і `product-form.*`; маршрут і клієнт уже є (T30, T32). Умова кнопки — та сама, що в стрілки, зі станом пропозиції з T74. `PRD.md §5` — руками |
| 8 | T66 | Локальний лоадер AI | `tdd` | `pw` — один платний виклик одного поля ≈ $0,005; суму назвати до й після | — | Спінер замінює обидві кнопки запуску поля з T73, стрілка лише вимикається. Поле запуску форма бере з власного запиту, бо `PreparationRunDto` його не несе; контракт не змінюється. Ціна (T54) прихована, `pw` її не перевіряє. `PRD.md §5` — руками |
| 9 | T75 | Компактніший шрифт | `goal` | `pw` на 1280 і 360 px | — | Верстка без поведінки під unit-тест, DoD вимірюваний: `getComputedStyle` дає розмір шрифту (умова нижче). Назви токенів звір із prebuilt-темою в контейнері до старту `/goal`, бо цикл писатиме їх з пам'яті. Чи текст лишився читабельним, оцінюєш сам на знімках |
| 10 | T76 | Кадри картки 120×120 | `goal` | `pw` на 1280 і 360 px | — | Та сама природа: один трек сітки, розмір кадру міряє `getBoundingClientRect` (умова нижче). Тести галереї мають лишитися зеленими без правок |
| 11 | T85 | Кома в ціні | `tdd` | `pw`: фільтр «Ціна від» з комою; комірку й поле картки лише перевірити на відсутність помилки, без збережень | — | Чиста функція `normalizePrice` у `product-catalog-query.ts` під unit-тест, контракт `api` не змінюється. Новий текст підказки RED вписує в тести, а не видаляє старі перевірки. `PRD.md §5` — руками |
| 12 | T86 | Одна помилка входу | `tdd` | `pw`: хибний пароль — один текст і дві червоні рамки; порожня форма — тексти під полями | `cpr` | Правка лише `login-page.html` і його spec. Diff чіпає `apps/web/src/app/auth/**`, тож ризик-гейт `critical-path-review` вмикається, хоч зміна — розмітка помилки. Не `tdd·r`: інваріант «не казати, котре поле хибне» тест лише фіксує. `PRD.md §5` — руками |
| 13 | T78 | Іконки редагування в комірці | `goal` | `pw` на 1280 і 360 px: спокій і режим редагування ціни й стану | — | Верстка без поведінки, DoD вимірюваний: `getBoundingClientRect` іконок і вертикальних центрів (умова нижче). Токени `matIconButton` звір із prebuilt-темою в контейнері до старту `/goal`, бо цикл писатиме їх з пам'яті. Тести каталогу мають лишитися зеленими без правок. `PRD.md §5` (AC-73) входить в умову |
| 14 | T79 | Скрол лише вмісту таблиці | `tdd` | `pw` на 1280×720, 1024×600 і 360×740: скрол, три рядки, нуль рядків, зміна висоти вікна | — | Правка наявних файлів, нових немає. RED: один `mat-paginator` і `sticky` рядок заголовків; тести T57 про верхній пагінатор RED переписує, а не видаляє. Розкладку (висоту, прилипання до краю вікна) юніт-тест не ловить, її перевіряє `pw`. Не `cpr`: ні сесій, ні грошей. `PRD.md §5` (AC-74 і переписане AC-51) і рядок-примітка в закритій T57 — руками, і після них gate-check теки `tasks/` |
| 15 | T80 | Нижчі тулбар, шапка й фільтри | `goal` | `pw` на 1280×720 і 360×740, з помилкою в «Ціна від» і без | — | Верстка, DoD вимірюваний (умова нижче). Стоїть за T75 і T79. Токени `mat-toolbar` і кнопок звір із prebuilt-темою до старту. Тести каталогу без правок |
| 16 | T87 | Назва OLX другим рядком | `tdd` | `pw` на 1280 і 360 px; картку з різними назвами дати через `page.route` на `GET /products` | — | Правка наявних `product-catalog.*`, стоїть за T80. RED переписує тести колонки `titleOlx`, а не видаляє. Кольори й шрифт — токени Material. `PRD.md §5` — руками |
| 17 | T81 | Зачистка номерів у `web` | `goal` | — | — | Механічна правка з вимірюваним DoD: `rg` і кількість тестів (умова нижче). `*.spec.ts` тут міняються (назви тестів), тож обмеження «нуль змін у spec» замінює рівність кількості тестів до й після. Правка `tdd-test-writer.md` і речення в `CLAUDE.md` — теж у Checklist |
| 18 | T82 | Зачистка номерів в `api` | `goal` | — | — | Те саме для `api`; у міграціях міняються лише коментарі. Кількість тестів фіксується в першому ж ході |

Кроки `PRD.md §5` і `openapi.yaml` у story агенти `/tdd` не роблять: вони правлять лише код.
Внеси їх руками до кроку Б. Для `goal`-задач ці кроки входять в умову «every Checklist item is
done», тож їх робить сам цикл.

**Готові умови `/goal` для T75, T76, T78, T80, T81 і T82** — за шаблоном нижче:

```
/goal docs/features/product-creation-flow/tasks/compact-app-typography.md: every Checklist item is done, with playwright-cli on /products at 1280 px the computed `font-size` of `body` is 13px and of `.catalog__header h1` is 20px, on an open card the computed `font-size` of `textarea[formcontrolname="titleProm"]` is 14px and no `mat-label` or `mat-hint` has a computed `font-size` below 11px, at 360 px `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on /products and with the card open, screenshots of the catalogue and the open card at both widths are saved, `git diff -U0 -- apps/web/src | rg '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\()'` prints nothing, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/shrink-card-gallery-frames.md: every Checklist item is done, with playwright-cli on an open card with at least two frames every `.gallery__item` has a `getBoundingClientRect()` width and height of 120 px at 1280 px and at 360 px, at 360 px the dialog has no horizontal scroll, a screenshot of the gallery at both widths is saved, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/shrink-cell-editor-icons.md: every Checklist item is done, with playwright-cli on /products at 1280 px and at 360 px the `mat-icon` inside the pencil button of the price cell and of the condition cell and inside the ✓ and ✕ buttons of an open price editor and of an open condition editor has a `getBoundingClientRect()` width and height of 16 px, in each open editor the input or `mat-select`, the ✓ and the ✕ have vertical centres within 1 px of each other, in the resting state the pencil button of each of those cells has a `getBoundingClientRect()` width and height of 24 px and the vertical centre of its `mat-icon` is within 2 px of the vertical centre of the value text next to it (a `Range` over the cell's text node), entering and leaving edit mode leaves the row's `getBoundingClientRect().height` unchanged, screenshots of the resting and editing states at both widths are saved, `git diff -U0 -- apps/web/src | rg '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\()'` prints nothing, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/shrink-app-bar-catalog-header-and-filters.md: every Checklist item is done, with playwright-cli on /products scrolled to the top at 1280×720 `mat-toolbar` has a `getBoundingClientRect()` height of 48 px, `.catalog__header` at most 34 px, `.catalog__filters` at most 100 px and the top of `.catalog__table` is at most 216 px, at 360×740 with an invalid «Ціна від» value the top of `.catalog__table` is at most 560 px, that field's `mat-error` lies fully inside the viewport width and `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, screenshots at both widths are saved, `git diff -U0 -- apps/web/src | rg '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\()'` prints nothing, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/drop-task-references-from-web-code.md: every Checklist item is done, `rg -nP '\bT(?!54\b)\d{2,3}\b|\bAC-\d|\bUS-\d|PRD §|sad\.md|\bstory\b' apps/web/src` prints nothing, `rg -c 'ADR [0-9]{4}' apps/web/src` prints the same lines as before the first edit, the test count printed by `docker compose run --rm web npm run test` equals the count recorded before the first edit, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run typecheck` exits 0, `git diff --stat` shows at most 500 changed lines; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/drop-task-references-from-api-code.md: every Checklist item is done, `rg -nP '\bT\d{2,3}\b|\bAC-\d|\bUS-\d|PRD §|sad\.md|\bstory\b' apps/api/src apps/api/db` prints nothing, `rg -c 'ADR [0-9]{4}' apps/api/src apps/api/db` prints the same lines as before the first edit, the `ℹ pass` count printed by `docker compose run --rm api npm run test` equals the count recorded before the first edit, `docker compose run --rm api npm run typecheck`, `lint` and `deps:check` exit 0, `git diff --stat` shows at most 500 changed lines; do not commit and do not edit tracker.md
```

## Відкладено

**T54 — пошук ціни через AI** відкладено 2026-09-21 рішенням власника: кожен виклик
`scope: price` коштував $0,27–0,77, і це задорого. Ціну вписують руками (AC-12). Код
пошуку лишається в `apps/api/src/modules/ai`, кнопку ціни в формі приховано з T32. Якщо
задача повернеться, її розбивка нижче досі чинна.

### Чому T54 розбита натроє

Її Checklist не лягає в один крок А: пункт 3 — це вимір на живому ключі, і саме з нього
виводяться пункти 4–6.

1. **`tdd·r`** — пункти 1–2: `.min(1)` на межах `PriceSchema` і тест на двійнику.
   Найдешевша фаза, і вона перша, бо робить дефект видимим, нічого не вимірюючи. Тести
   варто переглянути до GREEN: порожній рядок зараз проходить як успіх, і повз такий
   тест легко пройти вдруге.
2. **Головна сесія після скіла `claude-api`** — пункти 3–7: вимір, стеля вартості,
   явні `timeout` і `maxRetries` при створенні клієнта, лог тривалості. Не `goal` і не
   `/tdd`: агенти не мають ні `Skill`, ні `WebFetch`, а форму дефолтів SDK з пам'яті не
   видно — та сама причина, що вела T27. Вимір робиться свідомо: кожен виклик `scope:
   price` коштував $0,27–0,77, тож перед ним назви очікувану суму, а після — виміряну.
3. **`tdd`** — пункт 8: кнопка ціни назад у `product-form.html` і тест, який її прикриває.
   Нових файлів немає, тож Gate 2 не заважає. `pw` на живому стеку, бо AC-D вимагає
   непорожнього діапазону з джерелами.

## Умова `/goal`

Умова має три частини: вимірюваний стан, вивід раннера й обмеження. `node --test` друкує
`ℹ fail N` і назви `describe`, а не імена файлів, тож на конкретний тест посилаємось
назвою `describe`, яку умова й задає. Обмеження `git diff --stat -- '*.spec.ts'` не
пускає цикл «лагодити» наявні тести під свій код.

Якщо задача додає npm-пакет, порядок установки — частина умови: `node_modules` живуть в
образі контейнера, і без перебудови цикл упреться в «Cannot find module», а то й спробує
`npm install` на хості.

```
/goal docs/features/product-creation-flow/tasks/unify-readiness-badge-colors.md: every Checklist item is done, `rg -n "readiness--" apps/web/src/app --glob '*.css'` prints nothing, the computed `background-color` and `color` of `[data-testid="readiness"]` are equal in the catalogue row and in the open card dialog for both a ready and a not-ready card (checked with playwright-cli), `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

Хвіст `or stop after N turns` ненадійний, тож межу витрат став окремо.
