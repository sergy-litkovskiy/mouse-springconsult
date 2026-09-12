---
name: tdd
description: Координатор повного циклу Red → Green → Refactor для story mouse-springconsult через три ізольовані агенти (tdd-test-writer → tdd-implementer → tdd-refactorer) з перевірками в терміналі між фазами — тема коміту, код завершення тестів у контейнері, порожній `git diff -- '*.spec.ts'` після RED. Вмикай на "/tdd T10", "/tdd add-product-card-service", "прожени T10 через TDD", "RGR для story X", "запусти TDD-конвеєр". Прапорець --review-tests зупиняє конвеєр після RED для людського перегляду тестів; --from green продовжує з уже закоміченого RED. Лише для story з `gate_profile: implementation`; якісні гейти й оновлення tracker лишаються за feature-ship.
argument-hint: <story-id|story-slug> [--review-tests] [--from green]
allowed-tools: Bash, Read, Grep, Glob, Agent, AskUserQuestion
---

# tdd — координатор RGR

Цей скіл — диригент. Сам не пише ні тестів, ні коду: викликає три агенти з
`.claude/agents/`, кожен у власному контексті, і між ними перевіряє стан репозиторію
командами в терміналі. Будь-який гейт не пройшов — STOP із повідомленням, що саме
зламано й що робити далі.

Чому агенти, а не три кроки в цьому контексті: скіл виконується всередині головної
розмови, агент — у чистому вікні зі своїм системним промптом. Implementer, який бачив,
як писались тести, «знає», що автор мав на увазі, і реалізує намір замість
специфікації. Ізоляція працює, лише якщо агенти не бачать один одного — тому
координатор передає кожному **тільки** перелічені входи й ніколи не переказує
міркувань попереднього агента.

## Аргументи

- `<story>` — обовʼязковий: id (`T10`), slug файлу (`add-product-card-service`) або шлях.
- `--review-tests` — після Gate 1 зупинитись і дати людині переглянути тести.
- `--from green` — почати з Phase 2: RED уже закомічено (напр. після перегляду в
  попередній сесії).

## Спільне для всіх гейтів

Команди тестів — у контейнерах, як і все в цьому репо (скіл `mouse-commands`). Прогін
довгий: Bash з `timeout: 600000`. `pipefail` зберігає код завершення раннера крізь `tail`
і в bash, і в zsh:

```bash
# api — без --no-deps: тести репозиторіїв ходять у справжній Postgres
set -o pipefail; docker compose run --rm api npm run test 2>&1 | tail -n 80; echo "EXIT:$?"
# web — NO_COLOR, бо інакше рядок підсумку vitest перемежований ANSI-кодами
set -o pipefail; docker compose run --rm --no-deps -e NO_COLOR=1 web npm run test 2>&1 | tail -n 80; echo "EXIT:$?"
```

Лічильники, за якими гейт відрізняє «тести впали» від «тести не запустились» і рахує, які
саме впали:

| Застосунок | Раннер | Рядки підсумку | Коли їх немає |
|---|---|---|---|
| api | `tsc && node --test` | `ℹ tests T` · `ℹ pass P` · `ℹ fail N` · `ℹ cancelled C` | впав `tsc` — жоден тест не виконувався |
| web | vitest (`ng test`) | `Tests  N failed \| P passed (T)`; нульові частини vitest не друкує: `Tests  43 passed (43)` | впала збірка Angular |

`ℹ cancelled` — тести, чий хук (`before`, фікстура) упав: вони не виконувались і не
потрапляють ні в `pass`, ні в `fail`.

`APPS` — застосунки, яких торкнувся цикл: префікси `apps/api/`, `apps/web/` у
`git diff --name-only <BASE_SHA> HEAD`. Кожен гейт проганяє тести **кожного** з них.

Специфікація тут — не каталог `tests/`, а `*.spec.ts` поруч з кодом (конвенція
`CLAUDE.md`). Pathspec `'*.spec.ts'` у git матчить крізь каталоги, тож
`git diff -- '*.spec.ts'` покриває обидва застосунки.

Формат зупинки — однаковий для всіх гейтів:

```
STOP · Gate <N> · <перевірка>
Отримано: <фактичне значення>
Коміт: <SHA або "—">
Далі: <одна конкретна дія>
Відкат усього циклу (виконує людина): git reset --hard <BASE_SHA>
```

`git reset --hard` координатор **сам ніколи не виконує** — лише друкує.

## Pre-flight

1. `git branch --show-current` — не `main`.
   STOP: `On main. Create a branch first: git switch -c <story-slug>.`
2. `git status --porcelain --untracked-files=no` — порожньо. Невідстежувані файли не
   заважають: агенти додають у коміт лише конкретні шляхи.
   STOP: `Tracked changes present. Commit or stash them before /tdd.`
3. Знайти story — рівно один файл:
   ```bash
   grep -lE '^id: <ID>$' docs/features/*/tasks/*.md      # за id
   ls docs/features/*/tasks/<slug>.md                   # за slug
   ```
   Нуль або кілька збігів — STOP з переліком знайденого. Далі `STORY` — цей шлях.
4. `grep -E '^gate_profile:' "$STORY"` — `implementation`. `docs`, `decision`,
   `verification` не мають поведінки, яку можна покрити тестом.
   STOP: `Story <ID> is gate_profile: <x>; TDD applies to implementation stories only.`

   `implementation` ще не означає, що story має поведінку, яку можна покрити тестом. Story,
   чий Checklist — лише міграція, конфіг чи інфраструктура (compose, `Caddyfile`,
   `.env.example`), через `/tdd` не йде: test-writer не має чого специфікувати, а
   implementer нових файлів не створює. Автоматичного гейта тут немає — з тексту story
   цього надійно не визначити, тож рішення за тим, хто запускає `/tdd`.
5. Статус — з tracker, а не з frontmatter story (tracker є джерелом правди про статус):
   ```bash
   grep -E '^\| <ID> \|' "$(dirname "$STORY")/tracker.md" | awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}'
   ```
   Має бути `Todo` або `In progress`. `Blocked` чи `Done` — STOP із цим статусом.
6. Тема GREEN-коміту — з DoD story:
   ```bash
   grep -oE '(feat|fix)\([a-z0-9-]+\): [^`]+' "$STORY" | head -1
   ```
   Це `COMMIT_SUBJECT`; вміст дужок — `SCOPE`. Порожньо — STOP:
   `Story DoD has no commit line. Add "- [ ] Коміт: \`feat(<scope>): ...\`" to its DoD.`
   Тему не вигадуємо: story — контракт, і рядок коміту в ній пройшов гейти `feature-break-tasks`.
7. `docker compose ps >/dev/null 2>&1 && echo OK` — демон доступний.
   STOP: `Docker daemon unreachable. On this machine: docker context use colima.`
8. Базова лінія — тести **обох** застосунків: прогін короткий, а вгадувати, якого
   торкнеться story, не доведеться. Кожен — `EXIT:0` і нуль падінь.
   STOP: `Baseline is red: <tests>. /tdd starts from green.`
   Запамʼятати для кожного `BASE_PASS` і `BASE_TESTS` (`ℹ pass`/`ℹ tests` для api,
   `P passed (T)` для web) — за ними Gate 1 перевіряє, що впали саме нові тести.
9. `BASE_SHA=$(git rev-parse HEAD)` — запамʼятати для гейтів і звіту.

З `--from green`: кроки 1–7 ті самі, потім `RED_SHA=HEAD`, `BASE_SHA=HEAD~1`, одразу
**Gate 1** проти цього стану, і далі — Phase 2. Базової лінії тут немає: `BASE_SHA` уже
позаду, а прогнати тести на ньому без checkout не можна. Тому пункт 7 Gate 1
пропускається, і звіт це називає.

## Phase 1 — RED

```
Agent(
  subagent_type: "tdd-test-writer",
  description: "RED: failing specs for <ID>",
  prompt: "STORY=<STORY>\nSCOPE=<SCOPE>\nFollow your RED workflow: failing *.spec.ts per the story's acceptance criteria, signature stubs only where a spec would not compile, prove the failures are runtime failures, one commit `test(<SCOPE>): ...`. Last line: `RED phase commit: <SHA>`."
)
```

### Gate 1 — червоне, і червоне в рантаймі

1. `git status --porcelain --untracked-files=no` — порожньо (агент не лишив незакомічених правок).
2. `git rev-list --count <BASE_SHA>..HEAD` — рівно `1`. `RED_SHA=$(git rev-parse HEAD)`;
   має збігатися з SHA з останнього рядка агента.
3. `git log -1 --pretty=%s` починається з `test(<SCOPE>): `.
4. `git diff --name-only <BASE_SHA> HEAD -- '*.spec.ts'` — **не** порожньо.
5. Заглушки без поведінки:
   ```bash
   git diff <BASE_SHA> HEAD -- . ':(exclude)*.spec.ts' | grep -E '^\+.*\breturn\b'
   ```
   Порожньо. Інакше STOP: `RED commit adds a return outside specs — a stub with behaviour.`
6. Тести кожного з `APPS`: `EXIT` ≠ 0 **і** є лічильник падінь (таблиця вище) з N ≥ 1.
   - `EXIT:0` — STOP: `Specs pass on stubs: they check existing behaviour, not the story.`
   - `EXIT` ≠ 0, лічильника немає — STOP: `Red is a compile/build error, not a failing spec.`
7. Червоні саме нові тести й лише вони — проти базової лінії, для кожного з `APPS`:
   - api: `ℹ cancelled 0`.
     STOP: `Specs were cancelled: a hook or fixture failed. A broken spec is not RED.`
   - `pass` = `BASE_PASS`. Більше —
     STOP: `<k> new specs pass on stubs: existing behaviour or an unpinned error.`
     Менше — STOP: `<k> existing specs went red: RED adds failures, it does not cause them.`
   - `fail` = `tests − BASE_TESTS`.
     STOP: `Not every new spec failed: <fail> failed of <tests − BASE_TESTS> new.`

   Рядки `it(` у diff для цього не годяться: `it` у циклі — це один рядок і кілька тестів.

### `--review-tests`

Після Gate 1 — `AskUserQuestion`: «RED закомічено (`<RED_SHA>`, N тестів). Переглянь
`git show <RED_SHA>`. Правки до тестів — `git commit --amend`, щоб RED лишився одним
комітом.» Варіанти: **Продовжити до GREEN** · **Зупинити конвеєр**.

- Продовжити — повторити Gate 1 з тим самим `BASE_SHA` і тією самою базовою лінією
  (людина могла змінити тести: вони мусять лишитись червоними й рантаймовими), оновити
  `RED_SHA`, далі Phase 2.
- Зупинити — вивести `Stopped after RED at <RED_SHA>. Resume: /tdd <ID> --from green.
  Discard: git reset --hard <BASE_SHA>.` і завершити.

## Phase 2 — GREEN

```
Agent(
  subagent_type: "tdd-implementer",
  description: "GREEN: implement <ID>",
  prompt: "STORY=<STORY>\nRED_SHA=<RED_SHA>\nCOMMIT_SUBJECT=<COMMIT_SUBJECT>\nFollow your GREEN workflow: the specs in RED_SHA are a read-only contract; implement the stubs minimally within the layer rules of CLAUDE.md until the app's tests pass; one commit with exactly COMMIT_SUBJECT. Last line: `GREEN phase commit: <SHA>`."
)
```

### Gate 2 — зелене, специфікація недоторкана

1. `git status --porcelain --untracked-files=no` — порожньо.
2. `git rev-list --count <RED_SHA>..HEAD` — рівно `1`. `GREEN_SHA=$(git rev-parse HEAD)`.
3. `git log -1 --pretty=%s` — рівно `COMMIT_SUBJECT`.
4. `git diff --name-only <RED_SHA> HEAD -- '*.spec.ts'` — порожньо.
   STOP: `Implementer modified specs: <files>. The hard rule of the phase is violated.`
5. Тести кожного з `APPS` (перерахувати від `BASE_SHA`): `EXIT:0` і лічильник падінь 0
   (`ℹ fail 0` / підсумок vitest без `failed`).

## Phase 3 — REFACTOR

```
Agent(
  subagent_type: "tdd-refactorer",
  description: "REFACTOR: clean up <ID>",
  prompt: "STORY=<STORY>\nGREEN_SHA=<GREEN_SHA>\nSCOPE=<SCOPE>\nFollow your REFACTOR workflow: structure only, no behaviour change, only files touched by GREEN_SHA, tests after every step, specs read-only. One commit `refactor(<SCOPE>): ...`, or none if nothing is worth changing. Last line: `REFACTOR phase commit: <SHA>` or `REFACTOR phase: no changes — <reason>`."
)
```

### Gate 3 — зелене, межі фази дотримано

1. `git status --porcelain --untracked-files=no` — порожньо.
2. `git rev-list --count <GREEN_SHA>..HEAD` — `0` або `1`.
   - `0` — агент мусить був відповісти `REFACTOR phase: no changes — …`; причину
     переносимо у звіт, решта пунктів гейта не потрібна (стан = `GREEN_SHA`, вже перевірений).
   - `1` — `REFACTOR_SHA=$(git rev-parse HEAD)`, далі пункти 3–6.
3. `git log -1 --pretty=%s` починається з `refactor(<SCOPE>): `.
4. `git diff --name-only <GREEN_SHA> HEAD -- '*.spec.ts'` — порожньо.
5. Лише файли GREEN-коміту:
   ```bash
   comm -23 <(git diff --name-only <GREEN_SHA> HEAD | sort) \
            <(git diff --name-only <RED_SHA> <GREEN_SHA> | sort)
   ```
   Порожньо. STOP: `Refactor left the files of the GREEN commit: <files>.`
6. Тести кожного з `APPS`: `EXIT:0`, лічильник падінь 0.

## Фінальний звіт

```
TDD cycle complete for <ID> · <STORY>

  RED       <RED_SHA>       test(<SCOPE>): …
  GREEN     <GREEN_SHA>     <COMMIT_SUBJECT>
  REFACTOR  <REFACTOR_SHA>  refactor(<SCOPE>): …      | — no changes: <reason>

Gates
  ✓ 1  runtime red: api ℹ fail N / web Tests N failed; stubs without return
       only new specs red: pass = baseline <BASE_PASS>, N new of N   | — skipped: --from green
  ✓ 2  green: EXIT 0 in <APPS>; git diff <RED_SHA> HEAD -- '*.spec.ts' empty
  ✓ 3  green; specs untouched; only GREEN files refactored

Checklist of the story — /tdd covers what the specs observe; reconcile the rest with the diff:
  <пункти ## Checklist>

Check yourself:  git log --oneline <BASE_SHA>..HEAD
                 git diff <RED_SHA> HEAD -- '*.spec.ts'     # must be empty

Next: Checklist items missing from the diff — a separate commit before feature-ship;
      feature-ship (typecheck · lint · deps:check · migrations · smoke) and the tracker row;
      critical-path-review, if the diff touches auth or a Repository with a domain invariant.
```

Пункти Checklist — дослівно зі story:

```bash
awk '/^## /{p=($0=="## Checklist")} p && !/^## /' "$STORY" | sed '/^$/d'
```

Звіряти їх з diff — справа людини, не координатора. Пункт без поведінки (реекспорт в
`index.ts`, запис у composition root чи `ENTITIES`) жоден агент не робить: test-writer
пише лише специфікацію і заглушки, а implementer не створює нових файлів. Перенести
під'єднання в RED не можна — воно буває поведінкою: guard, зареєстрований разом із
маршрутом, зазеленив би тест «401 без сесії» ще на заглушках.

## Антипатерни

- **Фаза inline.** Тести чи код, написані в цьому контексті, — не TDD-конвеєр, а та сама
  розмова з додатковими кроками. Кожна фаза — окремий виклик `Agent`.
- **Переказ між агентами.** «Test-writer пояснив, що AC-15 має три входи…» у промпті
  implementer-а повертає забруднення контексту, від якого ізоляція й рятує. Агентові —
  лише його входи; решту він прочитає з git.
- **Лагодження за агента.** Агент не закрив фазу — це сигнал про story, тести чи стек.
  STOP і повідомлення; конвеєр не повинен «майже працювати».
- **Пропущений гейт.** Gate 2 (`git diff -- '*.spec.ts'`) — головний: без нього немає
  гарантії, що implementer не «виправив» тест під свій код.
- **`EXIT` ≠ 0 як доказ RED.** Для api це однаково може бути впалий `tsc`. Доказом є
  лічильник падінь, а не код завершення.
- **Сквош.** Три коміти — шар спостережуваності: з історії видно, де закінчилась
  специфікація і почалась реалізація. Склеювати їх — справа людини при мержі, не конвеєра.
- **Деструктивний git.** `reset --hard`, `restore` чужих файлів, `push` — координатор не
  виконує; друкує команду й зупиняється.
