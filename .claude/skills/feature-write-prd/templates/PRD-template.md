---
status: Draft
owner: "<заповни з idea-brief frontmatter owner>"
reviewers: []                    # у проєкті одна людина; рев'ю робить той самий owner
updated_at: "<сьогодні YYYY-MM-DD>"
feature_size: <з classify-size output: XS/S/M/L/XL>
stage: "03"
ticket: "<TBD>"
---

# PRD — <slug>

<!-- Skill instruction: посилання на required inputs + перелік selected additional channels через відносні шляхи або джерела. Format:

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](../../../CONTEXT.md)
> **Reference module:** `apps/api/src/modules/<name>` — code patterns used (error codes, boundary checks, status transitions). Якщо --reference не передано або user declined — пиши «N/A — green-field mode».
> **External context channels used:** перелічи selected channels з step-3 AskUserQuestion: «Project docs: docs/architecture/auth.md», «Projects knowledge: business-rules.md», або «None — only CONTEXT + idea-brief».

Не згадуй brainstorm або initiatives artifacts — це не inputs PRD. -->

## 1. Context

<!-- Skill instruction: 3-4 параграфи.
Параграф 1: Що вирішуємо. Витягни з idea-brief §2 Problem — конкретно, без abstraction. Цитуй segment з §3 Users.
Параграф 2: Чому зараз. Витягни з idea-brief §4 «Why now» / triggers (накопичений обсяг, готовність каркаса, тиск конкурентів).
Параграф 3: Прийнятий вектор — recommendation з idea-brief §13. 1-2 речення.
Параграф 4 (якщо було використано additional channels у step 3-4): Reference module patterns АБО цитовані джерела як **traceability context для §1**, не для §5 AC. Конкретно: «модуль `products` уже зберігає окремі поля під Prom і під OLX» / «правило з ADR 0003: три шари, виражені суфіксом класу» / «рішення міграції не зливати майданчики в одну колонку». Ці reference-patterns **не пробігають** у §5 AC — §5 описує business-observable outcome без HTTP/error-code/schema і без назв модулів (див. §5 instruction нижче).
Параграф 4 також — місце для «Decision overrides» bullets, які emit-ить Phase 7.5 critic: коли критик знаходить contested decision, а user обрав `Override`, додай bullet формату «<finding-headline> — overridden by author, rationale: <reason>» для traceability downstream.
Wikilinks: [idea-brief](./idea-brief.md), [CONTEXT](../../../CONTEXT.md).
Без архітектурних рішень — це WHAT+WHY, не HOW. Не згадуй Redis/Postgres/JWT тут.
Не згадуй brainstorm або initiatives artifacts — це outside scope. -->

## 2. Goals

<!-- Skill instruction: 2-3 виміряні outcomes у форматі bullet list.
Кожна goal — це прояв recommendation з idea-brief §13. Cite §13 directly. Без brainstorm/initiatives reference.
Формат: «<strategic outcome>, <quantifier if obvious — e.g. "одним кліком", "без ручного пошуку">».
Без чисел тут ОК — числа у §7 KPIs. Тут — strategic outcome.

Приклад:
- Юзер завантажує фото товару й отримує заповнену картку: опис під Prom, опис під OLX, ключові слова та превʼю головного кадру — без переходу в зовнішній чат -->

## 3. Non-goals

<!-- Skill instruction: 3-4 явні non-goals у bullet list.
Кожен non-goal: одне речення + причина (з idea-brief §5 Out of scope). Джерело — тільки idea-brief §5.
Формат: «- <non-goal>, <причина з idea-brief §5 або власне обґрунтування owner-а на review».»

Приклад:
- Прапорець published-olx чи published-prom не виводить товар на майданчик автоматично: юзер викладає дані вручну й сам проставляє прапорець (idea-brief §5 — інтеграції з майданчиками поза обсягом).
- <ще один non-goal з idea-brief §5>, <причина>.
- <ще один non-goal з idea-brief §5>, <причина>. -->

## 4. User stories

<!-- Skill instruction: ≥5 user stories, без верхнього cap. Skill пропонує стільки, скільки треба, щоб усі ролі з CONTEXT glossary + усі goals з §2 покриті. Формат:

### US-NN: <короткий title>
**As a** <role з CONTEXT glossary>
**I want** <action>
**So that** <observable benefit>

Кожна US — від recommendation з idea-brief §13 + role patterns з reference code (якщо reference channel selected — хто має CRUD permissions у reference module).
Title 3-6 слів, описує дію не сутність («Prepare texts for a card», не «Card text preparation»).
Кожна US покривається ≥1 AC у §5. -->

### US-01: <title>

**As a** <role>
**I want** <action>
**So that** <benefit>

### US-02: <title>

**As a** <role>
**I want** <action>
**So that** <benefit>

## 5. Acceptance criteria

<!-- Skill instruction: ≥1 AC кожного з 5 coverage types (happy / error / відмова зовнішнього
сервісу / domain invariant / cross-context), без верхнього cap. Skill пропонує стільки, щоб усі US покриті ≥1 AC + усі 5 типів
представлені. Формат:

### AC-NN (US-XX) — короткий title типу покриття
**Given** <business preconditions: стан картки товару, попередні події>
**When** <business action від actor-perspective: "user attempts to <verb> <domain-object>" або
"user opens <UI-context>">
**Then** <observable business outcome: user sees X / system blocks Y and explains Z / system records W>

AC описує **business-observable outcome від actor's perspective**. Не HOW система це робить.
Actor завжди один — `user` з глосарію CONTEXT (адмін). Інших ролей у системі немає; AC, який
вводить роль, вигадує домен.

**ЗАБОРОНЕНО у §5 AC text** (zero tolerance — перевіряє Phase 7.5 critic F6 + pre-write regex scan):
- HTTP verbs/methods (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`).
- URL paths (`/api/v1/...`).
- Status codes як bare numerics у тілі AC (`200`/`201`/`400`/`403`/`404`/`409`/`5xx`).
- Error-code strings формату `[a-z_]+\.[a-z_]+` (наприклад `product.not_found`,
  `validation.description_too_long`).
- JSON-schema fragments / payload bodies (`{key: "value"}`).
- SQL / DB constructs (`UNIQUE`, `FK`, raw SQL, constraint names).
- Назви технологій і модулів — як **цілі слова**: Claude, Anthropic, R2, sharp, pg-boss, TypeORM,
  JWT і ідентифікатори модулів `products`, `media`, `ai`. У AC є «система», а не її внутрішні
  частини. «AI» як доменне слово («допомога AI», «AI-підказка») дозволене — це не модуль `ai`.

Технічний mapping (endpoint+payload, status codes, error-code strings, схеми, DB-обмеження) належить
stage 10 (`sdlc:api-forge`) і `sdlc:decide-adr`; у цьому репозиторії їхні артефакти —
`apps/api/src/contracts/*.contract.ts` і `docs/adr/`. Тут — тільки WHAT actor спостерігає.

5 типів покриття обов'язкові (хоча б по 1 кожного):
1. **happy** — user виконує main flow → система зберігає результат і показує його.
2. **error** — user подає невалідний input → система блокує дію і пояснює причину
   («система показує, що ціна має бути додатнім числом»); без HTTP-коду й error-code-string.
3. **відмова зовнішнього сервісу** — зовнішній сервіс, від якого залежить фіча (модель, сховище
   файлів, джерело цін), недоступний або відповів помилкою → система зберігає те, що вже було
   збережено, прямо каже user-у, що крок не пройшов, і лишає картку в стані, з якого можна
   повторити. Називай, що вціліло і що бачить людина; без кількості повторів, таймаутів і назв
   сервісів — числа живуть у §6, технології у стадії 04-05.
   Раніше тут стояв **access** (немає сесії → вхід). Прибрано свідомо: користувач один,
   розмежування прав немає (CONTEXT: `user` — єдина людина, усі рівні), тож такий AC у кожній фічі
   виходив дослівно однаковим, а автентифікацію вже тримає модуль `auth`. Пиши його, тільки якщо
   фіча справді додає нову точку входу. Якщо фіча вимагає розмежування прав — це питання у §8.
4. **domain invariant** — user порушує названий інваріант («готова картка = обидва тексти + ціна +
   галерея», «до 10 фото на картку», «published-prom і published-olx рахуються окремо») → система
   блокує дію і називає інваріант звичайною мовою.
5. **cross-context** — дія залежить від стану в іншому контексті: фото → розпізнавання → тексти →
   ціна («система не запускає генерацію текстів, поки в картці немає жодного фото»,
   «система не пропонує ціну, поки розпізнавання не завершилось»). Формулюй через доменні слова
   глосарію, не через назви модулів.

Кожен AC tagged з US-NN. Часткова відмова (тексти повернулись, ціна ні — idea-brief §9) — окремий
AC, все ще business-language. -->

### AC-01 (US-01) — happy path

**Given** user has a product card with at least one uploaded photo
**When** the user starts preparing the texts for the card
**Then** the system saves the Prom description, the OLX description and the keywords into the card
and shows them to the user for editing

### AC-02 (US-01) — domain invariant violation

**Given** user has a product card whose price is empty
**When** the user marks the card as ready
**Then** the system blocks the transition and tells the user that a ready card needs both texts, a
price and at least one photo

### AC-03 (US-01) — external service failure

**Given** user has a product card with photos and asks the system to prepare the texts
**When** the service that prepares them is unavailable or answers with an error
**Then** the system keeps the photos and every value already saved in the card, tells the user that
the texts did not come through, and leaves the card ready for another attempt

## 6. Non-functional requirements

<!-- Skill instruction: таблиця, recommended list, без верхнього cap.
Колонки: Aspect | Target | Measurement.
Targets — ЧИСЛОВІ (≤400 ms, ≤60 с, ≤3 ₴). Без прикметників ("швидко", "надійно").
Якщо число невідоме → TBD з owner+due у §8 Open Questions, а не «швидко».

Measurement — те, чим у цьому проєкті реально можна виміряти: тривалість запиту з pino-логів,
час очікування в черзі pg-boss і кількість повторів з логів воркера, ручний прогін на стенді.
**Не пиши** k6, Prometheus, SLO-вікно, метрики endpoint'ів — цього в проєкті немає, і вигадана
метрика робить NFR невимірюваним.

Throughput і availability не пишемо взагалі: один-два користувачі, 50-100 карток на місяць —
пропускна здатність не є обмеженням.

Числовий таргет ставимо **тільки на власну поведінку системи**. Двох рядків тут свідомо немає, і
скіл не пропонує їх сам:
- **Тривалість AI-задачі** — її визначає латентність постачальника моделі, тож «≤ N с на картку»
  було б зобов'язанням за чужий сервіс.
- **Вартість картки** — потребує обліку `usage` і обраного провайдера, а це поки відкрите питання
  (idea-brief §8). До того часу вартість живе у §8, а не в §6.
Якщо user просить котрийсь із них — міряємо лише свою частину (очікування в черзі, кількість
повторів, кількість викликів на картку) і пишемо це прямо в колонці Measurement.

Рядки, які майже завжди потрібні (recommended floor, не cap):
- Відгук інтерактивної дії (збереження, відкриття списку).
- Обсяг і ліміти вхідних даних (фото на картку, розмір файлу).
- Поведінка при відмові зовнішнього сервісу — що лишається збережено і скільки разів повторюємо. -->

| Aspect | Target | Measurement |
|---|---|---|
| Відгук інтерактивної дії <operation> | ≤ <N ms> | тривалість запиту з pino-логів, <N> повторів на стенді |
| Обсяг і ліміти | <N> фото на картку, ≤ <N МБ> на файл | ручний прогін на межі ліміту |
| Очікування фонової задачі в черзі | ≤ <N с> від постановки до старту | pg-boss: enqueue → started, з логів воркера |
| Відмова зовнішнього сервісу | вже збережене не втрачається; <N> повторів, далі видима помилка | ручний прогін з вимкненим сервісом |

## 6.1 Security / privacy

<!-- Skill instruction: коротко. Це внутрішня адмінка на одного-двох користувачів без публічного
доступу — більшість типових пунктів тут дає шум, а не захист. Пиши тільки те, що фіча реально
змінює; для решти — «N/A» з причиною в півречення.

- **Дані:** internal. Персональних даних покупців у системі немає. Якщо фіча вводить нове поле з
  персональними даними — назви його явно: це виняток, а не норма.
- **Доступ:** уся адмінка за сесією (httpOnly-cookie). Ролей і розмежування прав немає
  (CONTEXT: `user` — єдина людина, усі рівні). Якщо фіча цього вимагає — питання у §8, не рядок тут.
- **Секрети:** чи додає фіча нові ключі чи креденшели. Правила проєкту, які не перевизначаються:
  ключ Anthropic, креденшели R2, пароль БД і JWT_SECRET у файлах Angular не з'являються ніколи;
  у логи не потрапляють паролі, токени сесій, ключі й повні тіла зображень.
- **Abuse cases (2-3, не 5)** — реальні для цього проєкту:
  1. **Неконтрольовані виклики AI** — це прямі гроші (idea-brief §10). Скільки запусків генерації
     на картку і на хвилину дозволено, і що бачить user, коли ліміт вичерпано.
  2. **Небезпечний файл на вході** — межа розміру й перевірка, що це справді зображення, до обробки.
  3. **Посилання на фото** — TTL presigned URL і чи воно не переживає сесію.
  Cross-org, draft-leak, SSRF пиши тільки якщо фіча приймає зовнішні URL або вводить
  багатокористувацькість. Інакше «N/A — чужих організацій і ролей у системі немає» чесніше за
  вигаданий сценарій.
- **Security review:** за замовчуванням N/A (внутрішня адмінка, без персональних даних, без
  публічних endpoint'ів). Required, якщо фіча додає зовнішній вхід (публічний endpoint, webhook,
  прийом файлів ззовні) або нові секрети. -->

- **Дані:** internal — <...>
- **Доступ:** <що змінює фіча, або «нічого: та сама сесія, розмежування прав немає»>
- **Секрети:** <нові ключі, або «нових немає»>
- **Abuse cases:**
  - <ліміт на виклики AI>: <скільки і що бачить user>
  - <файл на вході>: <ліміт розміру + перевірка типу>
- **Security review:** <N/A with reason / Required with reason>

## 7. Metrics / KPIs

<!-- Skill instruction: ≥3 KPI у bullet list, без верхнього cap. KPIs з idea-brief §13 Recommendation
+ §11 RICE Impact.
Формат: «- **<metric name>** — baseline: <X>, target: <Y за <таймфрейм>>».

Одиниця виміру — **картка**, а не користувач: у системі один-два адміни (idea-brief §3), тому
adoption rate, retention, cohort і return-to-feature тут не рахуються — 100% adoption досягається
тим, що людина відкрила власний інструмент. Не пиши таких KPI.

baseline=0 ОК для нової фічі. baseline=TBD → обов'язково план заміру до релізу (наприклад
«секундоміром на 10 картках поточного ручного процесу»).

Що зазвичай беремо:
- **Час на картку** — baseline з idea-brief §2 (15-20 хв ручних дій на позицію), target у хвилинах.
  Саме ці хвилини idea-brief §2 називає всією проблемою фічі.
- **Якість генерації** — частка карток, де текст пішов на майданчик без ручного правлення.
- **Прийнятність підказок** — частка запропонованих значень, які user лишив без правки.
- **Обсяг** — готових карток на місяць (сьогодні 50-100, idea-brief §1).

**Вартість картки за замовчуванням тут не пишемо.** Термін є в глосарії, але виміряти його нічим:
облік `usage` не заведений, провайдер не обраний. Поки це так — вартість лишається питанням у §8.
Пропонуй цей KPI, тільки якщо user попросив. -->

- **<metric 1>** — baseline: <...>, target: <... за ... днів>.
- **<metric 2>** — baseline: <...>, target: <...>.
- **<metric 3>** — baseline: <...>, target: <...>.

## 8. Open questions

<!-- Skill instruction: 2-4 open Q checkboxes.
Формат: `- [ ] <питання>? — owner: <ім'я з frontmatter owner>, due: <YYYY-MM-DD або стадія>`
Питання, які skill не зміг впевнено запропонувати з inputs/code.
Default відповідь у тексті питання, якщо вона є («Default зараз: <X>»).

owner — це людина з frontmatter `owner`, і зазвичай вона одна. PM, Tech Lead, Security Lead,
Data Owner у цьому проєкті не існують — не роздавай їм питань. due — або дата, або момент у роботі
(«перед scaffold», «перед першим викликом моделі на проді»).
«TBD» без owner — anti-pattern. -->

- [ ] <питання>? Default зараз: <...>. — owner: <owner з frontmatter>, due: <date or стадія>
- [ ] <питання>? — owner: <owner з frontmatter>, due: <date or стадія>
- [ ] <питання>? — owner: <owner з frontmatter>, due: <date or стадія>
