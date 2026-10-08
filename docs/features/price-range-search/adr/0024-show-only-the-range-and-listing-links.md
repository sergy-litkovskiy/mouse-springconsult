---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-10-08"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0024 — Показувати лише вилку й посилання на оголошення

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Відповідь Gemini з пошуком Google несе, крім тексту, `groundingMetadata.searchEntryPoint.renderedContent`
— HTML+CSS блок Google «Search Suggestions» із чипами пошукових запитів, які зробила модель. Умови
Gemini API (прочитано 2026-10-08) кажуть: «…will only display the Grounded Results with the
associated Search Suggestion(s) to the end user», і забороняють модифікувати чи перемішувати
Grounded Results з іншим вмістом. Власник вирішив, що адміну потрібні лише вилка й оголошення з
цінами: «адміну не потрібно показувати сам текст запиту… ніякого тексту промпта у iframe не
потрібно». PRD §8 залишив питання показу до SAD.

## Decision drivers

- Уточнення власника (idea-brief §1, PRD §2): під полем — лише вилка; оголошення — за інфо-іконкою.
- AC-05: для кожного оголошення — ціна й посилання в новій вкладці, плюс дата пошуку.
- AC-06, §1 QG-2: вилка не підставляється в поле й не має кнопки прийняття.
- PRD §6.1: посилання з видачі — недовірений ввід; чужий HTML у вікні адмінки — ризик.
- §2: умови Google вимагають показу Search Suggestions.

## Considered options

1. **Лише вилка й оголошення, ризик умов прийнято.** `renderedContent` не зберігається й не показується.
2. **Вилка й оголошення плюс чипи внизу модалки.** `renderedContent` у `<iframe sandbox srcdoc>`
   без скриптів, посилання — у новій вкладці.

## Decision outcome

**Chosen: опція 1** — за рішенням власника. Систему використовує одна людина, вона ж власник, і
чипи запитів їй нічого не дають, а відповідність умовам Google тут — свідомо прийнятий ризик, не
незнання.

1. Під полем ціни — «від — до ₴» і інфо-іконка; за нею (тултіп чи модалка — вибір етапу UI) —
   перелік оголошень (ціна + посилання) і дата пошуку.
2. Посилання показуються лише з `http:`/`https:` (ADR 0023 №2) як `<a target="_blank"
   rel="noopener noreferrer">`; HTML з відповіді ніде не рендериться.
3. `renderedContent` і `webSearchQueries` у БД не потрапляють; `webSearchQueries` пишеться лише в
   pino-лог воркера для діагностики заміру.
4. Стрілки «<- AI» в поля ціни немає, як і зараз
   ([ADR 0017](../../product-creation-flow/adr/0017-keep-one-latest-suggestion-per-field.md) №7).

## Consequences

**Positive**

- Мінімальний інтерфейс; у вікні адмінки немає чужого HTML, тож немає й `iframe`.
- Менше даних Google у БД — менше того, що підпадає під обмеження зберігання.

**Negative**

- Розходження з умовами Google: у разі претензії Google може обмежити проєкт чи ключ, і пошук
  ціни зупиниться (решта адмінки працює). Ризик High у §11 SAD, власник — Serhii.
- Повернути чипи для вже збережених вилок неможливо: `renderedContent` не зберігався.

**Neutral**

- Перейти на опцію 2 — додати поле в пропозицію й компонент у модалці, кілька годин; торкнеться
  лише нових пошуків.

## Links

- PRD: [PRD.md](../PRD.md) AC-01, AC-05, AC-06, §6.1, §8
- SAD: [sad.md](../sad.md) §2 Regulatory, §4 S5, §11
- Пов'язане: [ADR 0022](0022-keep-price-listings-inside-the-price-suggestion.md) — форма пропозиції `price`
