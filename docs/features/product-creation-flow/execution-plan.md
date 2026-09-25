# План виконання — product-creation-flow

Складено за графом [tracker.md](tasks/tracker.md) і правилами
[agentic-tools-playbook.md](../../../agentic-tools-playbook.md), §2 і §5.3. Статус живе
лише в tracker, цей файл описує тільки порядок і інструменти.

Порядок, інструменти й обґрунтування закритих задач — в
[архіві](_audit/execution-plan-archive.md); там же вісім умов `/goal`, які спрацювали
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

### Поставка 3 — UI каталогу й форми (T56–T76)

Запит 2026-09-21, T67–T74 — запит 2026-09-23, T75–T76 — 2026-09-25. Граф ([_epic.md](tasks/_epic.md)) лишає п'ятнадцять
задач незалежними, а ланцюжки має лише для T62, T65 і AI-кнопок поля (T67, T71 → T72 → T73 → T66,
T74). Задачі правлять одні й ті самі файли, тож порядок задають файли, а не граф. Доріжки:

- **каталог** (`product-catalog.*`): T56 → T60 → T57 → T64 → T65 — спершу чиста верстка
  (`goal`), потім правки з тестами, наприкінці найбільша й найризикованіша T65;
- **`api`** (`productListQuerySchema`): T61, потім T63 — обидві правлять ту саму схему, і T63
  вливається в уже змінений контракт, а не конфліктує з ним;
- **форма** (`product-form.*`, `suggestion-field.*`): T58 → T59 → T69 → T70 → T73 → T74 → T66.
  T69 і T70 — дрібні правки шаблону, тож ідуть першими й дають наступним уже зсунуті блоки. T66
  стоїть останньою, бо її спінер замінює обидві кнопки запуску з T73 у вже переробленому T74
  `app-suggestion-field`. T68 править лише `prom-description-editor.*`, тож іде паралельно з будь-чим;
- **T62** — після T59 (патерн chips), T60 (рядки CSS панелі) і T61 (перелік категорій);
- **`ai`** (`AnthropicAdapter.ts`, `PreparationService.ts`, `PreparationRunService.ts`):
  T67 → T71 → T72, додані 2026-09-23. Усі три правлять вхід моделі й ключ ідемпотентності поля,
  тож ідуть по черзі. З доріжкою форми ця доріжка сходиться на T73: кнопкам потрібен `mode` з T72;
- **T75, T76** — поза доріжками: правлять лише `styles.css` і `product-gallery.css`, яких не
  чіпає жодна відкрита задача, тож їх можна взяти будь-коли.

T62 і фронтова половина T63 теж правлять `product-catalog.*`, тож у доріжці каталогу вони
стають між T60 і T57. Один виконавець іде таблицею згори вниз; дві доріжки можна вести паралельно
лише в різних гілках, і тоді друга ребейзиться на першу.

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 1 | T56 | Підсвітка рядка | `goal` | `pw` | — | Верстка без поведінки під unit-тест, DoD вимірюваний (див. умову нижче). Назву токена `--mat-sys-*` звір із документацією Material 22 до старту `/goal`, бо цикл писатиме її з пам'яті |
| 2 | T60 | Вужчі фільтри-прапорці | `goal` | `pw` на 1280 і 360 px | — | Та сама природа, що T37 і T40: ширина полів і ціла мітка вимірюються. Обрізання плаваючої мітки оцінюєш сам на знімках |
| 3 | T61 | Категорії в `api` | `tdd` | `+обв'язка`: маршрут `GET /products/categories` у `ProductController`; смоук 401 і те, що `categories` не ловить `/:productId` | — | Поведінка під тест на живій базі: `IN (...)`, `DISTINCT`, нормалізація рядка в масив. Маршрут — обв'язка, агенти `/tdd` його не зареєструють, тесту на 401 не напишуть. `openapi.yaml` і `PRD.md §5` (кроки 6–7) — руками до кроку Б |
| 4 | T58 | Назви в textarea | `tdd` | `pw` | — | Правка наявних `product-form.*`, нових файлів немає. Поведінка «перенос → пробіл, Enter нічого не додає» тестується. `PRD.md §5` — руками |
| 5 | T59 | Ключові слова як chips | `tdd` | `pw` | — | Контрол стає масивом, і це зачіпає звірку T55 — її тести мають лишитися зеленими, тож RED переписує їх на масив, а не видаляє. `MatChipsModule` є в `@angular/material`, пакет не додається. `PRD.md §5` — руками |
| 6 | T62 | Кілька категорій | `tdd` | `pw` | — | Повторює патерн chips із T59 і додає `mat-autocomplete`; нових файлів немає. Стан у URL — масив, тож тест на збережену адресу з однією категорією обов'язковий. `PRD.md §5` — руками |
| 7 | T63 | Живий пошук | `tdd` | якщо тест регістру кирилиці червоний і виправлення — міграція, вона окремим комітом до `/tdd --from green`; `pw` | — | Регістр `ILIKE` залежить від ctype образу `postgres:18-alpine` — це доводить тест на живій базі, а не пам'ять. Живий пошук тестується фейковим часом. `openapi.yaml` і `PRD.md §5` — руками |
| 8 | T57 | Верхній пагінатор | `tdd` | `pw` | — | XS, але поведінка «два подання одного стану» тестується через `MatPaginatorHarness`. `PRD.md §5` — руками |
| 9 | T64 | Іконки публікації | `tdd` | `pw` | — | XS: тест на `aria-label` іконок, а не на колір. `PRD.md §5` — руками |
| 10 | T65 | Ціна й стан у комірці | `tdd·r` | `pw`: успіх, хибна ціна, 422 через `route`, `Esc` | — | Запис грошей: тести переглянути до GREEN — тіло `PATCH` з одним полем, жодного запиту для невалідної ціни, клік у режимі редагування не відкриває форму. Не `cpr`: код лише на фронті, маршрут і валідація `api` не змінюються. `PRD.md §5` — руками |
| 11 | T67 | Назви з «Згенерувати все» | `tdd` | `pw` — один платний виклик ≈ $0,012 | — | Правка наявних `.ts` в `ai`, нових файлів немає. Тести на двійнику адаптера, без мережі. Нормалізацію назви (перенос → пробіл, обрізання по слову до 200) тест фіксує для обох областей, `texts` і `field`: без неї пропозиція, яку `api` застосовує в порожнє поле, падає на `varchar(200)`. Не `cpr`: ні сесій, ні грошей. `PRD.md` (US-03, AC-05, AC-61) і `sad.md §6` сценарій 7 — руками |
| 12 | T68 | Опис Prom після відкриття | `tdd` | **до** кроку А — відтворення `pw` (крок 1 story); після — `pw` повторно | — | Дефект, гіпотеза — гонка `writeValue` із завантаженням Tiptap. Якщо `pw` її не підтвердив, задача йде в `plan`, а не в `/tdd`: тест на непідтверджену причину зафіксує не той дефект. `PRD.md §5` — руками |
| 13 | T69 | «Згенерувати все» під галереєю | `goal` | `pw` | — | Верстка без поведінки, DoD вимірюваний (умова нижче). Тести форми мають лишитися зеленими без правок |
| 14 | T70 | ID з копіюванням | `tdd` | `pw`: `navigator.clipboard.readText()` | — | Правка наявних `product-form.*`, нових файлів немає. `Clipboard` з `@angular/cdk`, пакет уже є. `PRD.md §5` — руками |
| 15 | T71 | Чернетка без тегів | `tdd` | — | — | Новий лише `draftPlainText.ts` (+ spec), решта — наявні `.ts`. Тест фіксує, що чистка стоїть до хешу. Живого виклику не потрібно: вхід моделі видно в двійнику адаптера. `openapi.yaml` (опис `409`) і `PRD.md §5` — руками |
| 16 | T72 | Режими `improve` і `prompt` | `tdd` | `pw` — два платні виклики `field`, ≈ $0,01 разом; суму назвати до й після | — | Промпти тестуються на двійнику адаптера: майданчик у тексті, відсутність `web_search`. `mode` у хеші й читання старої задачі без `mode` — під тест. Кнопок ще немає, тож `pw` шле `POST` з `mode` напряму. `openapi.yaml`, `sad.md` (S7, сценарій 10) і `PRD.md` (US-10, AC-21, AC-22, AC-66, AC-67) — руками |
| 17 | T73 | Три кнопки AI | `tdd` | `pw` — знімок tonal-кнопок, тултіпи, один платний виклик ≈ $0,005 | — | Правка наявних `suggestion-field.*` і `product-form.*`. Наявність tonal у `matIconButton` і назви іконок звірити з документацією до старту, бо агенти писатимуть їх з пам'яті. Тести на старі `aria-label` RED переписує, а не видаляє. `PRD.md §5` — руками |
| 18 | T74 | Остання пропозиція на поле | `tdd·r` | `pw` без платних викликів | — | Змінюється контракт читання картки, і від нього залежить AC-11: тести переглянути до GREEN, бо звірка має поводитись як раніше. Тести T53 і T55 RED переписує на `latestSuggestions`, а не видаляє. Не `cpr`: ні сесій, ні грошей. `openapi.yaml`, `sad.md` сценарій 9, `PRD.md` і excerpt-и закритих T53 і T55 — руками, і після них gate-check теки `tasks/` |
| 19 | T66 | Локальний лоадер AI | `tdd` | `pw` — один платний виклик ≈ $0,012 | — | Спінер замінює обидві кнопки запуску поля з T73, стрілка лише вимикається. Поле запуску форма бере з власного запиту, бо `PreparationRunDto` його не несе; контракт не змінюється. Ціна (T54) прихована, `pw` її не перевіряє. `PRD.md §5` — руками |
| 20 | T75 | Компактніший шрифт | `goal` | `pw` на 1280 і 360 px | — | Верстка без поведінки під unit-тест, DoD вимірюваний: `getComputedStyle` дає розмір шрифту (умова нижче). Назви токенів звір із prebuilt-темою в контейнері до старту `/goal`, бо цикл писатиме їх з пам'яті. Чи текст лишився читабельним, оцінюєш сам на знімках |
| 21 | T76 | Кадри картки 120×120 | `goal` | `pw` на 1280 і 360 px | — | Та сама природа: один трек сітки, розмір кадру міряє `getBoundingClientRect` (умова нижче). Тести галереї мають лишитися зеленими без правок |

Кроки `PRD.md §5` і `openapi.yaml` у story агенти `/tdd` не роблять: вони правлять лише код.
Внеси їх руками до кроку Б. Для `goal`-задач ці кроки входять в умову «every Checklist item is
done», тож їх робить сам цикл.

**Готові умови `/goal` для T56, T60, T69, T75 і T76** — за шаблоном нижче:

```
/goal docs/features/product-creation-flow/tasks/highlight-catalog-row-on-hover.md: every Checklist item is done, with playwright-cli on /products the computed `background-color` of a hovered `.catalog__row` differs from that of a row without the pointer and the row text has a contrast of at least 4.5:1 against it, `git diff -U0 -- apps/web/src/app/products/catalog/product-catalog.css | rg '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\()'` prints nothing, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/narrow-catalog-flag-filters.md: every Checklist item is done, with playwright-cli on /products at 1280 px the three fields labelled «Опубл. на Prom», «Опубл. на OLX» and «Картка готова» are each narrower than 168 px and every `mat-label` inside them has `scrollWidth <= clientWidth` both empty and with «Так» selected, at 360 px `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, screenshots at both widths are saved, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/move-generate-all-below-gallery.md: every Checklist item is done, with playwright-cli on an open card with one frame `[data-testid="generate-all"]` follows `app-product-gallery` and precedes `[data-field="titleProm"]` in document order (`compareDocumentPosition`), a screenshot of the dialog is saved, `git diff -U0 -- apps/web/src/app/products/form/product-form.css | rg '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\()'` prints nothing, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/compact-app-typography.md: every Checklist item is done, with playwright-cli on /products at 1280 px the computed `font-size` of `body` is 13px and of `.catalog__header h1` is 20px, on an open card the computed `font-size` of `textarea[formcontrolname="titleProm"]` is 14px and no `mat-label` or `mat-hint` has a computed `font-size` below 11px, at 360 px `document.documentElement.scrollWidth <= document.documentElement.clientWidth` on /products and with the card open, screenshots of the catalogue and the open card at both widths are saved, `git diff -U0 -- apps/web/src | rg '^\+.*(#[0-9a-fA-F]{3,8}\b|rgba?\()'` prints nothing, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

```
/goal docs/features/product-creation-flow/tasks/shrink-card-gallery-frames.md: every Checklist item is done, with playwright-cli on an open card with at least two frames every `.gallery__item` has a `getBoundingClientRect()` width and height of 120 px at 1280 px and at 360 px, at 360 px the dialog has no horizontal scroll, a screenshot of the gallery at both widths is saved, `docker compose run --rm web npm run lint` exits 0, `docker compose run --rm web npm run test` exits 0, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
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
