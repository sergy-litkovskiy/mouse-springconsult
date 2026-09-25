---
id: T75
title: "Компактніший шрифт"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1700
blocked_by: []
blocks: []
updated_at: "2026-09-25"
---

# T75 — Компактніший шрифт

## Context

Запит 2026-09-25. Шрифт усього сайту, а надто картки товару, завеликий. Власник просить
компактніше, але так, щоб текст лишався читабельним.

Розміри тексту задають токени Material з prebuilt-теми (`prebuilt-themes/azure-blue.css`), усі в
`rem`. Поля картки мають `body-large` (16 px), основний текст (`body` у `styles.css`) —
`body-medium` (14 px), h1 каталогу — `headline-small` (24 px). Шкалу зсуваємо на крок униз:

| Токен | Було | Стане |
|---|---|---|
| `body-large` | 400 1rem / 1.5rem (16 px) | 400 0.875rem / 1.25rem (14 px) |
| `body-medium` | 400 0.875rem / 1.25rem (14 px) | 400 0.8125rem / 1.125rem (13 px) |
| `headline-small` | 400 1.5rem / 2rem (24 px) | 400 1.25rem / 1.75rem (20 px) |
| `title-large` | 400 1.375rem / 1.75rem (22 px) | 400 1.25rem / 1.75rem (20 px) |
| `title-medium` | 500 1rem / 1.5rem (16 px) | 500 0.875rem / 1.25rem (14 px) |
| `title-small` | 500 0.875rem / 1.25rem (14 px) | 500 0.8125rem / 1.125rem (13 px) |

Для кожного токена перевизначаються і `--mat-sys-<токен>-size`, і shorthand `--mat-sys-<токен>`:
компоненти Material читають обидва. `label-*` і `body-small` (11–12 px) лишаються: це вже
нижня межа читабельності. `font-size` на `html` не змінюємо, тож відступи й розміри в `rem`
лишаються на місці.

**Чому `:root`, а не `html`.** Prebuilt-тема оголошує токени на `html` (специфічність 0,0,1).
`:root` має 0,1,0 і перебиває її, хоч би в якому порядку підключено стилі. **Лише `rem`:**
розміри в токенах — без `px`, кольорів правка не торкається.

## Sequence

Власного сценарію немає: це верстка, запити не змінюються. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `styles.css`.

## API contract excerpt

Каталог — сторінка `listProducts`; задача змінює вигляд тексту, а не склад:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/Page" }
        - { $ref: "#/components/parameters/PageSize" }
```

## Acceptance criteria

Нове AC із запиту 2026-09-25; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-70 (нове) — happy path**
**Given** `user` відкриває `/products` на екрані шириною 1280 px, а потім картку товару
**When** сторінка й діалог відмальовані
**Then** основний текст має 13 px, текст у полях картки — 14 px, заголовок каталогу — 20 px

**AC-70 — accessibility**
**Given** шрифт зменшено на крок
**When** `user` дивиться на каталог і відкриту картку на 1280 і 360 px
**Then** жоден `mat-label` чи підпис не менший за 11 px, а на 360 px немає горизонтального скролу

## Checklist

1. `styles.css`: у блоці `:root` перевизначити `-size` і shorthand шести токенів за таблицею; розміри в `rem`, без `px` і hex.
2. Звірити назви токенів і склад shorthand (вага, гарнітура) з `prebuilt-themes/azure-blue.css` у контейнері `web`, а не з пам'яті; якщо тема має окремі `-line-height`, перевизначити і їх.
3. `pw`: знімки `/products` і відкритої картки на 1280 і 360 px; `getComputedStyle` дає 13 px для `body`, 20 px для h1 каталогу й 14 px для `textarea` назви Prom; жоден `mat-label` і `mat-hint` не менший за 11 px; на 360 px `scrollWidth <= clientWidth`.
4. `PRD.md §5`: AC-70 з посиланням на цю story.

## Out of scope

- `label-*`, `body-small` і `headline-large`/`headline-medium` — останні в застосунку не вживаються.
- Відступи, висота полів і розміри іконок.
- Мініатюри каталогу й кадри галереї — кадри змінює [T76](shrink-card-gallery-frames.md).

## DoD

- [ ] AC-70: шкалу зсунуто на крок, підписи не дрібніші за 11 px, на 360 px скролу немає.
- [ ] Наявні тести `web` зелені, `lint` зелений.
- [ ] Коміт: `style(web): step the type scale down one notch`.

## Links

- [T56](highlight-catalog-row-on-hover.md) — попередня правка стилів через токени Material
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
