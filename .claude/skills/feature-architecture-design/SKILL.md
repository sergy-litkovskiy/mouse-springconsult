---
name: feature-architecture-design
description: >
  Use when the user wants a Software Architecture Document (SAD) — Arc42, 12
  sections — plus the ADRs for a feature of the mouse-springconsult admin panel,
  after the PRD is closed. Triggers on "architecture for {slug}", "SAD for
  {slug}", "arc42 for {slug}", "архітектура для {slug}", "stage 04-05 for
  {slug}", "C4 context+container for {slug}", "/feature-architecture-design
  {slug}". Drafts §1-§12 in memory from PRD + CONTEXT + idea-brief + the repo's
  own architecture documents, then validates section by section through
  AskUserQuestion (Approve / Edit / Save as Open Question / Drop), spawns an ADR
  only when a decision crosses the blast-radius gate, and writes each resolved
  section to disk as it goes. A clean-context critic reads the finished document
  before the single closing commit. C4 levels 1-2 inline (Context in §3,
  Container in §5); no L3/L4. Prerequisite: docs/features/{slug}/PRD.md — hard
  refuse if missing. GATE stage 🚪.
stage: "04-05"
---

# Skill: feature-architecture-design (SDLC stages 04-05 🚪 GATE)

Generator of `docs/features/<slug>/sad.md` (Arc42, 12 sections) plus the ADRs the pass
earns. Per-section batch validation, one `AskUserQuestion` per decision, each resolved
section written to disk immediately, an ADR spawned only when a decision crosses the
**blast-radius** threshold (*масштаб удару* — наскільки боляче буде передумати рішення).
Detail per Protocol step lives in `references/`; this file is the backbone.

The document itself is the state: sections land on disk as they are resolved, so a
Ctrl-C costs only the section in flight. C4 Context (L1) and Container (L2) live inline
in §3 and §5 as Mermaid blocks. L3 Component and L4 Code are out of scope.

## Як це читати

Це інструкція для агента, який запускає skill. Порядок читання при першому відкритті:
`## When to use` і `## Inputs` → `## Protocol` (8 кроків) → references на конкретний крок
→ `## Self-check`.

**Словничок:**

- *blast radius* — масштаб удару: наскільки боляче буде передумати рішення через півроку.
- *ADR-gate* — три критерії, на яких рішення заслуговує окремого файлу, а не рядка inline.
- *MADR* — формат ADR-файлу: статус, контекст, драйвери, опції, рішення, наслідки.
- *4-state machine* — чотири дії з рішенням: **Прийняти** / **Виправити** / **Винести у
  відкрите питання** / **Викинути**.
- *Save-as-OQ* — рішення не приймається зараз, переїжджає в §11 як відкрите питання з
  власником і дедлайном.
- *clean-context critic* — підагент, який бачить лише готовий файл, а не діалог, і шукає
  протиріччя між секціями.

## Мова артефактів

**Тіло SAD і ADR — українською.** Англійською лишаються: заголовки секцій Arc42
(`## 4. Solution strategy`), ключі frontmatter, статуси (`Accepted`), імена файлів ADR,
ідентифікатори коду, шляхи, назви таблиць і колонок, повідомлення API. Це те, що вже
лежить у репозиторії — `docs/adr/0001-0003` і сім ADR `product-creation-flow`.

Коментарі в шаблонах, звернені до агента, теж українською — їх не копіюють у вихідний файл.

## Owner

Serhii — у цьому проєкті одна людина суміщає Architect, Tech Lead, розробника й PM.
Не вигадуй окремих SRE / DevOps / PM для таблиці stakeholders у §1 і не адресуй їм
мітигації в §11: якщо владник не названий явно — це Serhii.

## When to use

- Після того, як `feature-write-prd` створив `docs/features/<slug>/PRD.md`.
- `/feature-architecture-design <slug>` як явний виклик.
- Skip, якщо `docs/features/<slug>/sad.md` уже має 12 заповнених секцій (вміст або
  `<!-- N/A: причина -->`) і в `adr/` є ≥1 файл — тоді пропонуй рев'ю, а не новий прохід.

## Inputs (HARD REFUSE if missing)

- `<slug>` — той самий slug, що й на попередніх етапах.
- `docs/features/<slug>/PRD.md` — обов'язковий, із заповненими §2 Goals і §6 NFR.
  Немає → відмова + пропозиція `feature-write-prd <slug>`.
- `CONTEXT.md` у корені — `## Glossary` канонічний для доменних термінів і ролей.

## Protocol

1. **Prereq check (hard refuse).** `test -f docs/features/<slug>/PRD.md` → не 0 = відмова
   + пропозиція `feature-write-prd <slug>`. Візьми `feature_size` з frontmatter PRD;
   немає — спитай одним `AskUserQuestion` (шкала — у [./references/checklist.md](./references/checklist.md)).
2. **Read required inputs.** `PRD.md` — карта секцій цього проєкту: §1 Context,
   §2 Goals, §3 Non-goals, §4 User stories (US-NN), §5 Acceptance criteria (AC-NN),
   §6 NFR, §6.1 Security/privacy + abuse cases, §7 Metrics/KPIs, §8 Open questions.
   `CONTEXT.md` `## Glossary` — виграє в конфлікті з будь-чим. `idea-brief.md` — саме
   там живуть §11 RICE, §12 Feasibility і §13 Recommendation (у PRD їх немає).
3. **Repo reading.** Читай напряму, без підагента — архітектура тут описана явно:
   `ARCHITECTURE.md` (патерн, розгортання, модулі, dependency rule, наскрізний потік),
   `CLAUDE.md` у корені, `apps/web/CLAUDE.md` і `CLAUDE.md` тих модулів, яких торкається
   фіча, `SPEC.md` (обіцянки продукту — часте джерело розходжень), `apps/api/.dependency-cruiser.cjs`
   (правила, які виконуються машиною), `ls` по `apps/api/src/modules/*` і
   `apps/web/src/app/*` — фактичний стан коду проти документів. Перелік і що з кожного
   брати → [./references/draft-generation.md](./references/draft-generation.md).
4. **Bootstrap.** Копія `./templates/sad-template.md` → `docs/features/<slug>/sad.md`,
   правка frontmatter (`updated_at`, `feature_size`, `ticket`). Без коміту — коміт один,
   на кроці 8.
5. **Read own templates.** `./templates/sad-template.md` (інлайн-коментар кожної секції —
   контракт її генерації) + `./templates/adr-template.md` (MADR).
6. **Per-section draft (in-memory).** Для §1 → §12: чорновик + перелік рішень усередині
   секції + злиття тривіальних дефолтів у одне питання. Джерела на секцію, item-banks,
   pre-Socratic hygiene → [./references/draft-generation.md](./references/draft-generation.md).
7. **Socratic validation + ADR-gate + запис секції.** Для §1 → §12: (a) покажи всю
   запропоновану секцію з нумерованим переліком рішень; (b) по одному `AskUserQuestion`
   на рішення, 4-state machine; (c) застосуй переходи в пам'яті; (d) для кожного
   Прийнятого прожени blast-radius gate ([./references/blast-radius-heuristic.md](./references/blast-radius-heuristic.md))
   і спавни ADR, якщо спрацював; (e) **запиши секцію та її ADR у файли** — без коміту;
   (f) наступна секція. До вже записаної секції skill не повертається — розходження між
   секціями ловить критик на кроці 8. Переходи, лог правок, посадкове місце Save-as-OQ,
   нумерація ADR → [./references/socratic-loop.md](./references/socratic-loop.md). Форма питань
   → [./references/ask-examples.md](./references/ask-examples.md). Ритм → [./references/socratic-cadence.md](./references/socratic-cadence.md).
   C4 для §3 і §5 → [./references/c4-mermaid-syntax.md](./references/c4-mermaid-syntax.md).
8. **Критик + єдиний коміт.** Один `Agent` (`subagent_type: "general-purpose"`, чистий
   контекст) з готовим `sad.md`, логом правок, логом спавнів ADR і шляхами до `PRD.md` /
   `CONTEXT.md` / `idea-brief.md` / `adr/`. Знахідки вирішуються через `AskUserQuestion`
   (`Accept` / `Accept, інше формулювання` / `Override (обґрунтування)`; `Override` дописує
   булет у §1 ¶4). Далі — регексні перевірки (Mermaid, формат назв ADR, сироти §9),
   Self-check нижче, і **один коміт на весь прохід**. Деталі → [./references/critic-phase.md](./references/critic-phase.md),
   тіло промпту → [./references/critic-prompt.md](./references/critic-prompt.md).

## Куди лягають ADR і як вони нумеруються

Файли фічі — у `docs/features/<slug>/adr/`. **Нумерація наскрізна на весь репозиторій** і
продовжує `docs/adr/` (рішення рівня системи), щоб посилання «ADR 0007» ніколи не було
двозначним. Наступний вільний номер шукається по обох теках:

```bash
ls docs/adr/*.md docs/features/*/adr/*.md 2>/dev/null \
  | xargs -n1 basename | grep -oE '^[0-9]{4}' | sort -n | tail -1
```

Плюс один, з нулями до чотирьох знаків. Порожній вивід → перший номер `0001`.

## Коміт

Один коміт наприкінці кроку 8, у форматі етапів SDLC цього репозиторію:

```
NN: SAD + ADR for <slug> via feature-architecture-design
```

`NN` — наступний номер після останнього коміту з таким префіксом (`git log --oneline -20`).
**Slug підставляється обов'язково** — коміт `cfa228d` вийшов як «SAD + ADR for via
architecture-design» з порожнім місцем, це дефект, а не формат. Тіло коміту називає:
обсяг документа (якщо фічу розділено — що саме входить у цю поставку), перелік ADR
одним рядком на файл, і свідомі розходження з підписаними документами з §11.

Conventional Commits (`feat(products): …`) — формат коду, не артефактів SDLC.

## Self-check

Повний DoD, анти-патерни й логіка N/A → [./references/checklist.md](./references/checklist.md).
Тут — те, що не обговорюється:

- Крок 3 виконано: §2 Constraints і §5 спираються на `ARCHITECTURE.md` + `CLAUDE.md` +
  фактичний `ls` модулів, а не на здогад.
- Лог правок ведеться: кожен `Edit` / `Drop` / `Save as Open Question` має запис із
  дослівними `before` / `after` / `user_reason`. `Approve` у лог не потрапляє — це базова лінія.
- §11 містить рядок на кожне `save_as_oq`-рішення, і в ньому заповнені **обидва** поля —
  owner і due. Порожнє будь-яке з них → рішення понижується до `Drop` з видимим попередженням.
- Крок 8 критик відпрацював; кожна знахідка або вирішена, або перекрита `Override` з булетом у §1 ¶4.
- §3 має блок `C4Context`, §5 — блок `C4Container`, обидва з реальними іменами з CONTEXT
  і репозиторію, без `<placeholder>`.
- §6 має ≥1 `sequenceDiagram` (для M і більше — 3-5, і серед них хоча б один сценарій відмови).
- §9 посилається на кожен файл у `adr/`, і кожен рядок §9 веде на наявний файл.
- Ролі в §1 і актори в §3 збігаються з глосарієм `CONTEXT.md` дослівно. У цій системі
  `user` — єдина людина, а не роль: не вигадуй `admin` / `manager` / `operator`.
- Кожен ADR має `Status: Accepted` (skill синхронний) і назву-**рішення** в наказовій формі:
  `0007-serve-images-from-a-public-bucket.md` ✓ проти `0007-image-access.md` ✗.
- Номери ADR продовжують наскрізну нумерацію репозиторію, а не починаються з 0001.
- Один коміт, формат `NN: … via feature-architecture-design`, slug на місці.

Будь-яка перевірка впала → повертайся до відповідного `AskUserQuestion` і перевіряй знову.

## References

- [./references/draft-generation.md](./references/draft-generation.md) — крок 3 і 6: що
  читати в репозиторії, джерела й item-banks по §1-§12, pre-Socratic hygiene.
- [./references/socratic-loop.md](./references/socratic-loop.md) — крок 7: потік по секції,
  4-state machine, схеми логів, посадкове місце Save-as-OQ, спавн ADR.
- [./references/ask-examples.md](./references/ask-examples.md) — форма `AskUserQuestion` на
  кожен тип рішення + ADR-gate + вирішення знахідок критика.
- [./references/critic-phase.md](./references/critic-phase.md) — крок 8: диспатч, цикл
  вирішення, регексні перевірки, режими відмови.
- [./references/critic-prompt.md](./references/critic-prompt.md) — тіло промпту підагента,
  шість класів помилок (F1-F6).
- [./references/checklist.md](./references/checklist.md) — DoD, анти-патерни, логіка N/A,
  очікувана кількість ADR.
- [./references/blast-radius-heuristic.md](./references/blast-radius-heuristic.md) — коли
  рішення заслуговує ADR.
- [./references/socratic-cadence.md](./references/socratic-cadence.md) — як пройти 12 секцій,
  не втомивши користувача.
- [./references/c4-mermaid-syntax.md](./references/c4-mermaid-syntax.md) — C4Context і
  C4Container на прикладах цього репозиторію.

## Templates

- [./templates/sad-template.md](./templates/sad-template.md) — 12 секцій Arc42 з інлайн-контрактом
  генерації, C4 L1/L2 інлайн, frontmatter, форма рядка §11 для відкритих рішень.
- [./templates/adr-template.md](./templates/adr-template.md) — MADR.
