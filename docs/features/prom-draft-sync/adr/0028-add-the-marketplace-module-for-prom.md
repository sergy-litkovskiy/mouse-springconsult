---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-10-10"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0028 — Завести модуль `marketplace` для Prom, а стан відправки тримати в `products/prom-sync`

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Це перша інтеграція адмінки з майданчиком, і вона перекриває рядок «Не пишемо інтеграцію з Prom/OLX
зараз» розділу «Чого НЕ робимо» кореневого `CLAUDE.md`. `ARCHITECTURE.md` уже передбачає, що
синхронізація стане модулем `marketplace` разом з першим файлом. Треба вирішити, де лежить знання
про Prom API, а де — стан відправки, який показує картка, і куди дивиться стрілка між модулями.

## Decision drivers

- `CLAUDE.md`, правила 2–3: модуль бачить інший лише через `index.ts`, циклів немає.
- `ARCHITECTURE.md`, «Модулі»: «Синхронізація з Prom/OLX стане модулем `marketplace`… `products` при
  цьому переробляти не доведеться».
- Наявний патерн: запуск підготовки й таблиця живуть у `products/preparation`, а зовнішній сервіс і
  обробник у `worker` — в `ai`; стрілка `ai` → `products`.
- §1 QG-2: стан відправки видно на самій картці — читання картки має вміти його віддати.
- PRD §8: модуль `marketplace` і правка `CLAUDE.md` — кандидат в ADR на gate 3.

## Considered options

1. **`marketplace` + `products/prom-sync/`** — `marketplace` тримає адаптер Prom API, побудову файлу
   імпорту й обробник задач у `worker`; entity, репозиторій, сервіс запуску, контролер і черга
   відправки — у `products/prom-sync/`.
2. **Усе в `marketplace`** — таблиця, маршрути, адаптер і обробник в одному модулі.
3. **Без нового модуля** — адаптер Prom прямо в `products/prom-sync/`.

## Decision outcome

**Chosen: `marketplace` + `products/prom-sync/`.** Лише ця опція тримає стрілки спрямованими вниз
(`marketplace` → `products` і `marketplace` → `media` для файлу імпорту, ADR 0031) і водночас дозволяє читанню картки віддати стан відправки: у варіанті 2
`products` мусив би імпортувати `marketplace`, який уже імпортує `products`, — цикл. Варіант 3
суперечить `ARCHITECTURE.md` і тому, як живе `ai`: домен знав би формат чужого API.

## Consequences

**Positive**

- Знання про Prom API в одному модулі; OLX ляже поруч, не чіпаючи `products`.
- Повторює знайому пару `preparation` + `ai`: та сама форма запуску, контролера й обробника.
- `products` не імпортує `marketplace`, тож `deps:check` нових правил про цикли не потребує.

**Negative**

- Фіча розкладена між двома модулями; щоб прочитати потік повністю, треба відкрити обидва.
- Нова entity — новий рядок у `ENTITIES` `.dependency-cruiser.cjs` і в списку entity обох точок
  входу.
- Рядок «Чого НЕ робимо» в `CLAUDE.md` і таблиця модулів `ARCHITECTURE.md` застаріють — правка разом
  з першим файлом модуля (§11 SAD).

**Neutral**

- Перенести адаптер в інший модуль пізніше — перенесення файлів і правка `index.ts`, без міграції.
- HTTP-клієнт Prom — лише `fetch` Node; окремої залежності рішення не вводить.

## Links

- PRD: [PRD.md](../PRD.md) §8
- SAD: [sad.md](../sad.md) §4 S2, §5
- Пов'язане: [ADR 0013](../../product-creation-flow/adr/0013-call-media-from-products-as-a-storage-adapter.md) —
  той самий принцип «технічний модуль без домену картки»
- Пов'язане: [ADR 0031](0031-hand-the-import-file-to-prom-from-the-public-bucket.md) — друга стрілка
  `marketplace` → `media`
- Пов'язане: [ADR 0020](../../price-range-search/adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) —
  попереднє рішення про межу модуля для нового зовнішнього постачальника
