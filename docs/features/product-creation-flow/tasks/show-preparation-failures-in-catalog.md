---
id: T50
title: "Помилки підготовки в каталозі"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: M
context_budget: 2100
blocked_by: [T29, T32]
blocks: [T33]
updated_at: "2026-09-21"
---

# T50 — Помилки підготовки в каталозі

## Context

Запит 2026-09-19, зроблений під час T28. Підготовка вміє закінчуватись відмовою двох видів:
`price_unavailable`, коли тексти є, а ціни немає (AC-10b), і `preparation_failed`, коли всі
спроби задачі впали (AC-10, [events.md](../contracts/events.md)). Про кожну окрему відмову
`user` дізнається в діалозі картки, поки триває полінг ([T32](add-preparation-ui.md)).
Звідти не видно, скільки таких відмов назбиралось по картках: зачинив діалог і втратив цю
інформацію.

Задача додає в каталог `/products` колонку з кількістю невдалих запусків підготовки картки.
Поруч — спосіб подивитися, **що саме** пішло не так: тултіп або попап зі списком відмов.

## Open items — закрито 2026-09-21

1. **Текст помилки — варіант (б).** Нова колонка `error_detail text NULL` у
   `product_preparation_runs` (міграція окремим комітом). Вона тримає англійське
   повідомлення помилки, яка закрила запуск: виняток адаптера для `price_unavailable`,
   останню спробу для `preparation_failed`, фіксований текст для запуску, закритого
   прибиральником застряглих. Довжину обмежує константа в `config.ts`. У попапі деталь
   стоїть дрібно під українським текстом, який фронт бере за `errorCode`. Запуски, що
   впали до міграції, мають `null` і показуються лише українським текстом.
2. **Попап.** Тултіп не працює на дотик на 360 px. Попап — новий компонент з `.html`, тож
   крок А веде `scaf`.
3. **Рахуємо всі `failed` за весь час.** Попап показує рівно ті відмови, які порахувало
   число.

Лишалося ще одне рішення з AC-49: коли відмов немає, клітинка **порожня**.

Нумерація: AC-35 і AC-36 у PRD уже зайняті (T38), тож сценарії цієї задачі йдуть під
AC-49, як у T48/T49 — один номер на задачу.

## Sequence

Власного сценарію в [sad.md §6](../sad.md#6-runtime-view) немає. Число читається разом зі
сторінкою каталогу. Список відмов картка довантажує лише на клік, коли людина відкриває
попап.

## Data delta

| Що | Зміна |
|---|---|
| схема | `product_preparation_runs.error_detail text NULL` |
| читання списку | `count(*) filter (where status = 'failed')` по `product_preparation_runs` у тому самому запиті сторінки, без N+1 |
| індекс | `product_preparation_runs_product_id_idx` |

## API contract excerpt

Наявна схема `PreparationRun`, з якої береться текст відмови:

```yaml
        errorCode:
          type: [string, null]
          description: >-
            Заповнено лише при status=failed; той самий код, що показує AC-10.
            `price_unavailable` — часткова відмова `scope: both`: пропозиції текстів
            записані, пропозиції `price` немає, ціну просить окремий `scope: price` (AC-10b).
            `preparation_failed` — усі спроби задачі впали, пропозицій немає (AC-10, events.md).
```

Рядок списку каталогу отримує нове поле `failedRuns: integer, minimum: 0` (Checklist 1).
`PreparationRun` отримує `errorDetail: string | null`. Список відмов віддає
`GET /products/{productId}/preparation-runs?status=failed`: масив `PreparationRun`,
найновіші першими. Невідома картка → 404 `product_not_found`.

## Acceptance criteria

**AC-49** (US-03, US-04) — happy path
**Given** картка має запуски підготовки, частина з яких завершилась `failed`
**When** `user` відкриває каталог
**Then** у рядку картки видно кількість невдалих запусків, а на клік — список відмов з
областю, часом і текстом помилки українською

**AC-49** (US-03, US-04) — edge case
**Given** картка не мала жодного невдалого запуску
**When** `user` відкриває каталог
**Then** замість числа порожньо, і попап не відкривається

## Checklist

1. Контракт рядка списку — `failedRuns: integer`.
2. Репозиторій — лічильник у запиті сторінки.
3. Міграція `error_detail` (окремий коміт), запис деталі в `PreparationService` і
   `closeStuckRuns`, маршрут `GET …/preparation-runs?status=failed` (`scope`, `errorCode`,
   `errorDetail`, `finishedAt`).
4. `apps/web` — колонка каталогу і попап. Текст за `errorCode` бере мапінг T32, а не власну
   копію.
5. `openapi.yaml`, `data-model.md`, `PRD.md` §5 (AC-49).

## Out of scope

- Повтор запуску з попапу. Повтор лишається в діалозі картки (AC-23).
- Облік вартості відмов. Токени вже враховано у вартості картки (AC-14, T31).

## DoD

- [x] Open items 1–3 закрито й записано в цю story до старту.
- [x] Лічильник рахується в запиті сторінки, а не окремим запитом на рядок: скалярний
  підзапит у тому самому `SELECT` (`ProductRepository.list`), тест на реальному Postgres.
- [x] Текст помилки українською, код назовні не показується сам по собі: мапінг
  `run-failure-messages.ts` спільний з діалогом картки, тест каталогу перевіряє, що коду в
  попапі немає.
- [x] `pw` на 1280 і 360 px: колонка й попап — 2026-09-21 на dev-базі з двома тимчасовими
  `failed`-запусками (видалено після перевірки); горизонтального скролу немає, деталь
  переноситься.
- [x] Коміт: `feat(products): show preparation failures in the catalogue`.

## Links

- [events.md](../contracts/events.md) — коди й наслідок кожної спроби
- [T32](add-preparation-ui.md) · [T43](add-catalog-image-viewer.md)
- [data-model.md](../data-model.md) — `product_preparation_runs.error_code`
