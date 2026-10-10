# Audit — data-model, prom-draft-sync, 2026-10-10

**Результат.** Прохід змінює схему: додає таблицю `product_prom_sync_runs` з двома індексами й
чотирма CHECK. Видалення `products.category` спроектовано, а міграцію відкладено до story US-05.

## Generated / changed files

| File | Change |
|---|---|
| `docs/features/prom-draft-sync/data-model.md` | новий |
| `apps/api/db/migrations/1791630446458-create-prom-sync-runs.ts` | новий, через `db:migrate:new` |
| `apps/api/src/modules/products/prom-sync/PromSyncRun.ts` | новий entity; перший файл підпапки `prom-sync/` |
| `apps/api/.dependency-cruiser.cjs` | + `products/prom-sync/PromSyncRun` в `ENTITIES` |
| `apps/api/db/schema.spec.ts` | + `insertPromSyncRun()`, + 6 тестів, + таблиця в `resetTables` |

## Decisions made this pass

1. **`title_prom` лишається `varchar(200)`** (вирішив власник 2026-10-10). Межа 130 — правило
   майданчика, тож її тримають zod на збереженні (AC-05) і гейт відправки. Звужений тип зробив би
   міграцію залежною від даних на проді, а AC-05 якраз описує картки з довшою назвою. На dev довших
   за 130 — 0 з 559, максимум 128.
2. **Частковий результат = `failed` + код** (вирішив власник 2026-10-10). Коди:
   `prom_photos_incomplete` і `prom_not_draft`. Статуси збігаються з підготовкою, `succeeded`
   означає лише N з N з `prom_id`, і KPI PRD §7 рахується простою часткою.
3. **Без верхньої межі `images_on_prom <= images_total`.** За ризиком sad.md §11 повторний імпорт може
   задублювати фото, і такий CHECK обвалив би запис звіту у `worker`. Поведінку закріплює тест
   «records more photos on Prom than were sent».
4. **`images_total` зберігається, а не виводиться.** N з «фото K з N» — галерея на момент
   відправки. Картку після неї можуть змінити.
5. **`prom_product_id` не дублює `products.prom_id`.** Він живе лише до успіху, а на `succeeded`
   переходить у картку. Ознака «товар на Prom» одна для імпортованих і відправлених карток (ADR 0029).
6. **«Перевірити ще раз» повертає той самий рядок у `running`**, а не створює новий. Новий рядок
   означав би нову подачу. Це єдиний виняток з «завершена подія остаточна», і entity це документує.
7. **Без `error_detail`.** Текст Prom — недовірений ввід, і ні в UI, ні в лог не йде (sad.md §8).
8. **Без колонок під файл імпорту й лічильники звіту.** Ключ R2 виводиться з id (ADR 0031), а
   лічильники йдуть лише в лог (ADR 0030).
9. **Міграцію `− category` відкладено.** Колонку використовують ~15 файлів бекенду й фронт, тож
   міграція без них ламає читання картки. Форму міграції зафіксовано в `data-model.md` §Migrations.

## Default deviations

Розходжень з дефолтами скіла немає. Усі рішення лягають у таблицю Defaults: одна TypeORM-міграція,
`uuidv7()`, `timestamptz`-моменти без `updated_at`, `CHECK` на закритий перелік і числові межі,
`error_code` без CHECK, як у `product_preparation_runs`, FK без relation-декораторів.

## Registration checklist

- [x] `db:migrate:new` для нового файлу міграції, без ручного timestamp.
- [x] `ENTITIES` у `.dependency-cruiser.cjs` — `products/prom-sync/PromSyncRun`.
- [ ] Entity у `entities` в `src/api.ts` і `src/worker.ts`. **Не в цьому проході**: реєструється разом із
      `PromSyncRepository` у story репозиторію (sad.md §5, «Точки реєстрації»).
- [ ] `contracts/products-limits.ts`: межі Prom (130 / 50 / 1024 / 10) й прибирання
      `categoryMaxLength`, `categoryFilterMaxItems`. **Не в цьому проході**: жодна колонка ними не
      обмежена. Вони йдуть у story US-02 і US-05 відповідно.

## Self-check

| Check | Result |
|---|---|
| naming `plural snake_case` / `snake_case` | ok |
| `down()` — точний реверс `up()` | ok: `drop table` знімає таблицю, індекси й constraints |
| FK `product_id` має індекс у тій самій міграції | ok, `product_prom_sync_runs_product_id_idx` |
| relation-декоратори | немає |
| lookup-таблиці | немає; статуси й коди — union-и |
| `prettier`, `typecheck`, `lint`, `deps:check` | зелені (`deps:check`: 118 modules, 0 violations) |
| `npm run test` | 512 / 512 pass |
| `db:migrate` → `db:migrate:revert` на dev | чисто; dev-база повернута до `KeepOneSuggestionPerField1791042544223` |

## Drift findings

Дрейфу немає. `User`, `Product`, `ProductImage`, `PreparationRun`, `FieldSuggestion` звірено з
`create table` / `alter table` своїх міграцій. Колонки, типи й nullability збігаються, а `PromSyncRun`
збігається з `1791630446458` за побудовою.

## Deferred entities / changes

| Change | Owner stage |
|---|---|
| `− products.category` (міграція `drop-product-category`) | story US-05 |

## TBDs

- `docs/features/prom-draft-sync/data-model.md:217` — довжина `prom_import_id` (звірити з OpenAPI
  Prom, етап 10).
- `docs/features/prom-draft-sync/data-model.md:220` — код свіпу для завислої відправки (етап 10).

## Next stage

Етап 10: `/feature-api-forge prom-draft-sync`. Контракт відправки (`prom-sync.contract.ts`), коди в
`error-codes.ts`, звірка викликів `PromAdapter` з OpenAPI Prom.
