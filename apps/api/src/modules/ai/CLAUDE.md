# Правила роботи з AI-модулем

- Claude (`claude-sonnet-5`, [ADR 0018](../../../../../docs/adr/0018-use-sonnet-5-for-card-preparation.md))
  готує тексти й переписує поле; вилку ціни шукає Gemini
  ([ADR 0020](../../../../../docs/features/price-range-search/adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md)).
  Модель і параметри виклику (`effort` у Claude) — константи `src/config.ts` **окремо на кожен виклик**
  (тексти, ціна, поле), щоб підняти один, не чіпаючи решти. Не env-змінні: заміна моделі
  змінює якість генерації, формат відповіді й собівартість картки, тому має проходити
  через коміт і рев'ю, а не через рестарт контейнера з іншим значенням.
- **Оптимізація перед відправкою.** Зображення до AI йде через sharp: довша сторона
  ≤ 1568 px, JPEG q80, sRGB, EXIF вирізано (константи в `src/config.ts`). Це свідоме
  зменшення рахунку, а не ліміт моделі: `claude-sonnet-5` приймає до 2576 px по довшій
  стороні (до ~4784 візуальних токенів на кадр). Фото товару такої деталізації не
  потребує; якщо розпізнавання почне помилятись — межу піднімаємо, попередньо
  перемірявши вартість через `count_tokens`.
- На розпізнавання відправляємо максимум 3 кадри (константа), а не всю галерею. Додаткові фото завантажуються **без** AI.
- **Розпізнавання товару — вхід моделі, а не окреме поле.** Модель розпізнає, що це за
  річ, як частину того самого виклику, що готує тексти під обидва майданчики; результат
  ніде не персистується окремо ([ADR 0014](../../../../../docs/features/product-creation-flow/adr/0014-let-ai-recognize-the-item-from-photos.md)).
- **Регенерація одного поля** (область запуску `field`) — text-only виклик без зображень:
  вхід — чернетка поля з тіла запиту, вихід — один рядок пропозиції для того самого поля
  ([ADR 0015](../../../../../docs/features/product-creation-flow/adr/0015-add-per-field-text-rewrite-scope.md)). Той самий `usage`-облік і той самий шлях через worker, що й для
  фото-викликів.
- **Без зайвого форматування.** Відповідь Claude запитуємо через structured outputs
  (`output_config.format` з JSON-схемою) і зберігаємо як plain text. Markdown,
  емодзі, обгортки «Ось ваш опис:» — не генеруємо і не парсимо. Опис для Prom у картці
  є HTML, але модель його теж повертає plain text. У `<p>` його перетворює `web`, коли адмін
  переносить пропозицію у форму, а не цей модуль; `api` чистить HTML через `cleanDescription`
  під час збереження картки
  ([ADR 0016](../../../../../docs/features/product-creation-flow/adr/0016-store-the-prom-description-as-html.md) №7,
  [ADR 0017](../../../../../docs/features/product-creation-flow/adr/0017-keep-one-latest-suggestion-per-field.md) №5).
- **Живе до [T107](../../../../../docs/features/price-range-search/tasks/remove-anthropic-price-search.md)**,
  яка прибирає пошук через Anthropic після go на гейті заміру.
  Пошук ринкових цін — server tool `web_search_20260209`; повертаємо діапазон + посилання
  на джерела, ціну не вигадуємо. `user_location` — `timezone: 'Europe/Kyiv'`, не
  `country: 'UA'`: провайдер пошуку відмовляє на цьому коді країни («not supported»,
  знайдено на живому прогоні 2026-09-19). Локалізацію «в Україні, у гривнях» несе
  сам текст запиту.
- **Адаптер Gemini.** `@google/genai` імпортує лише `GeminiAdapter.ts` (правило
  `google-genai-sdk-stays-in-the-adapter`). Виклик — без `retryOptions`: один запит на запуск,
  а відмову `PreparationService` класифікує в `price_not_found` / `price_quota_exhausted` /
  `price_unavailable` і закриває запуск без throw, тож pg-boss його не повторює
  ([ADR 0023](../../../../../docs/features/price-range-search/adr/0023-classify-price-search-failures-and-never-retry-them.md)).
  Structured outputs на 2.5 не працюють разом із пошуком, тому JSON вилки розбирається з тексту
  відповіді zod-схемою; збій розбору — `price_not_found`, а не падіння.
- Adaptive thinking (`thinking: {type: "adaptive"}`) увімкнено; `budget_tokens`
  не використовуємо — параметр видалено на цій моделі. Ціну знижуємо через
  `output_config.effort` (старт — `low` на всіх викликах Claude), а не вимкненням thinking.
- **Розробка майже не витрачає API.** Тести підміняють адаптер тестовим підкласом
  (`ScriptedAnthropicAdapter` у `PreparationService.spec.ts`) і перевіряють записаний запит,
  тож ключа немає ні в тестах, ні в CI. Локальний `worker` без `ANTHROPIC_API_KEY` не
  стартує, а з ключем кожен запуск підготовки — живий платний виклик. Ключ розробки — з
  окремого workspace Console з лімітом $10 на місяць. Живий виклик — свідома дія, серія
  прогонів оцінюється в доларах до запуску.
- **Оплата — API-кредитами плану Max, а не логіном підписки.** Організація Console з
  ключами розробки й проду прив'язана до Max: місячні API-кредити ($100 для Max 5x, з
  2026-10-07) оплачують той самий Messages API за тими самими цінами, тож облік вартості
  картки не змінюється. Залишок кредитів не переноситься на наступний місяць, а вичерпаний
  баланс без платіжного методу зупиняє виклики до нового циклу; стеля workspace зупиняє
  раніше. Адаптера на логіні підписки (токен `claude setup-token`, Agent SDK) не робимо:
  [правила Anthropic](https://code.claude.com/docs/en/legal-and-compliance) лишають цей
  логін для власних застосунків Anthropic, сервісам — API-ключ; блокування можливе без
  попередження, а ліміти спільні з інтерактивною роботою в Claude Code.
- Кожен виклик Claude записує `usage` (`input_tokens`, `output_tokens`) і `model` у свій рядок
  `product_preparation_runs` — без цього неможливо рахувати собівартість картки. Окремої
  таблиці `ai_generations` немає: вартість картки — сума по запусках. Виклик Gemini
  `recordUsage` не кличе: запуск `price` має `model` Gemini й нульові токени, а
  `config.ai.pricing` — рядок Gemini з нульовим тарифом; токени й `webSearchQueries` ідуть лише
  в pino-лог воркера ([ADR 0025](../../../../../docs/features/price-range-search/adr/0025-keep-gemini-calls-out-of-the-token-ledger.md)).
- Виклики AI виконуються **тільки у worker** через чергу. HTTP-запит не чекає на AI.
