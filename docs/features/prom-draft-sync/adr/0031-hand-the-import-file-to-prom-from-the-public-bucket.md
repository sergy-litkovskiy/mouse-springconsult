---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-10-10"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0031 — Передавати файл імпорту Prom через публічний бакет R2

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Відправка йде імпортом Prom за посиланням (`import_url`): саме на нього спирається PRD — схеми
`PostProductsImportUrlRequestBody` і `ImportStatus`, поведінка `mark_missing_product_as: none` за
замовчуванням, перевірена пробою 2026-10-10. Prom скачує файл сам, тож йому потрібна публічна
адреса. Рішення визначає, чи з'являється в системі публічний не-кадр, маршрут без сесії або
залежність `marketplace` → `media`.

## Decision drivers

- §1 QG-1: гарантія недоторканності каталогу перевірена саме на `import_url`.
- AGENTS.md P0: маршрут без `sessionGuard` блокує мердж.
- [ADR 0007](../../product-creation-flow/adr/0007-serve-images-from-a-public-bucket.md): бакет уже
  публічний на читання, і Prom скачує з нього фото.
- PRD §6.1: назовні йдуть лише дані картки й публічні адреси фото.
- `ARCHITECTURE.md`: R2-клієнт живе в `media` (`ImageStorage`), SDK — лише там
  (`s3-sdk-stays-in-image-storage`).

## Considered options

1. **Публічний бакет R2** — `worker` кладе xlsx за ключем `prom-imports/<id відправки>.xlsx`, віддає
   Prom його постійну адресу й видаляє об'єкт після остаточного статусу.
2. **Файл тілом запиту** — імпорт файлом (`import_file`, multipart), без публічної адреси.
3. **Маршрут `api` з одноразовим токеном** — `api` віддає файл за адресою з токеном, без сесії.

## Decision outcome

**Chosen: публічний бакет R2.** Це той самий `import_url`, на якому перевірена гарантія QG-1, і та
сама публічна межа, з якої Prom уже скачує фото. Варіант 2 вимагав би повторної проби на живому
магазині до першої відправки. Варіант 3 вводить перший маршрут без `sessionGuard`, токен і колонку
під нього.

## Consequences

**Positive**

- Жодного нового маршруту й жодного винятку з `sessionGuard`.
- Prom скачує файл і фото з одного джерела — збої доступу в них спільні й однаково видні.

**Negative**

- До видалення файл публічний за адресою з uuid. Вгадати її неможливо, а вміст — тексти й ціна,
  які за хвилини будуть у кабінеті Prom.
- `media` отримує запис і видалення не-зображення без перевірки сигнатури — перший такий шлях.
  Перевірка тут зайва, бо файл формує наш код, а не браузер, але це новий метод публічного API
  `media`.
- Падіння між записом і видаленням лишає сироту в R2; її прибирає свіп завислих відправок
  ([ADR 0027](0027-poll-prom-through-a-chain-of-short-jobs.md)).

**Neutral**

- Перейти на варіант 2 пізніше — замінити один метод `PromAdapter` і зняти залежність від `media`,
  без міграції даних.

## Links

- PRD: [PRD.md](../PRD.md) §1 Traceability, §6.1
- SAD: [sad.md](../sad.md) §5, §6
- Пов'язане: [ADR 0007](../../product-creation-flow/adr/0007-serve-images-from-a-public-bucket.md) —
  публічний бакет, з якого Prom скачує фото
- Пов'язане: [ADR 0013](../../product-creation-flow/adr/0013-call-media-from-products-as-a-storage-adapter.md) —
  `media` як адаптер сховища без домену
