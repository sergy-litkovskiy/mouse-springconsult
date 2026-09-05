---
id: T12
title: "Знести product_images.url і складати адресу з ключа"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T06, T11]
blocks: [T14]
updated_at: "2026-09-05"
---

# T12 — Знести `product_images.url` і складати адресу з ключа

## Context

Колонка `url` дублює те, що вже випливає з ключа: перший же переїзд бакета вимагав би
скрипта, який переписує всі рядки
([ADR 0007](../adr/0007-serve-images-from-a-public-bucket.md)).
[data-model.md](../data-model.md) свідомо відклав цю зміну на стейдж 13 і назвав її
**нероздільною**: без домену бакета в конфігурації адресу з ключа не скласти, а розділення
на два коміти дало б проміжний деплой, де одна половина не відповідає іншій.

Тому міграція, entity, контракт і мапінг у DTO — один PR. Це прямий виняток із «одна зміна
на PR», і підстава в нього документована.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1**, два останні кроки — саме те, що ця
задача робить можливим:

> `api-->>web: кадр із адресою, складеною з ключа`
> `web->>r2: читає кадр за цією адресою`

## Data delta

| Таблиця | Зміна | Напрямок |
|---|---|---|
| `product_images.url` | `TEXT NOT NULL` → **колонка зникає** | нова міграція `<timestamp>-drop-product-image-url.ts` |
| `product_images.r2_key` | лишається `TEXT NOT NULL UNIQUE` — єдине джерело адреси | без змін |
| `down` | повертає `url` як `NOT NULL` з тимчасовим дефолтом | інакше відкат впаде на наявних рядках |

Міграція **нова, а не правка наявної**: `1787756956906-create-products-tables` уже накочена,
і колонка реально існує в базі ([api-sync-report.md](../contracts/api-sync-report.md),
перевірено напряму). Рішення спирається на фактичний стан прода
([sad.md §11](../sad.md#11-risks-and-technical-debt), останній рядок Low).

## API contract excerpt

```yaml
  /products/{productId}/images:
    post:
      responses:
        "201":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ProductImage" }
```

`ProductImage` після цієї задачі несе `r2Key` і складену `url` як **похідне** поле
відповіді, а не колонку.

## Acceptance criteria

**AC-01** (US-01) — happy path
**Given** кадр записано у сховище
**When** `user` відкриває картку
**Then** браузер читає кадр за постійною адресою, складеною з ключа, і повторне відкриття не коштує нічого

**AC ([ADR 0007](../adr/0007-serve-images-from-a-public-bucket.md)) — domain invariant**
**Given** домен бакета змінився
**When** картка читається
**Then** адреса складається наново з нового домену — жодного рядка в базі переписувати не потрібно

## Checklist

1. Створити міграцію `<timestamp>-drop-product-image-url.ts`; `down` повертає колонку з тимчасовим дефолтом.
2. `ProductImage.ts` — колонка `url` зникає.
3. `products.contract.ts` — `productImageSchema` без `url` як колонки, з `r2Key`.
4. `ProductController.ts` — повна адреса складається з `R2_PUBLIC_BASE_URL` і ключа в момент мапінгу в DTO, **рівно в одному місці**.
5. `apps/web/` — місця, де читався `url`, читають складене поле відповіді.

## Out of scope

- Реєстрація класу міграції: `db/migrations-glob.ts` — це glob, переліку класів у репозиторії немає, тож реєструвати нічого ([sad.md §5](../sad.md#5-building-block-view) виправлено).
- Похідні розміри — їх немає взагалі ([ADR 0011](../adr/0011-store-only-the-original-frame.md)).

## DoD

- [ ] `db:migrate` вниз і вгору проходить на тестовій базі — обидва напрямки перевірені, не лише `up`.
- [ ] У жодному файлі, крім міграції `down`, слова `url` як колонки `product_images` не лишилось — перевірено `grep`.
- [ ] Адреса кадру складається рівно в одному місці, і це видно з коду.
- [ ] Кадр відкривається в браузері за складеною адресою — смоук проти живого бакета.
- [ ] `npm run test` в `api` і `web` зелений.
- [ ] Коміт: `feat(products): derive the image URL from its storage key`.

## Links

- [ADR 0007](../adr/0007-serve-images-from-a-public-bucket.md) · [sad.md §4 S2](../sad.md#s2-кадри-читаються-з-публічного-бакета-а-повна-адреса-складається-з-ключа)
- [data-model.md, Migrations](../data-model.md) — рядок «− `product_images.url` | етап 13»
- [CONTEXT.md](../CONTEXT.md) — «ключ обʼєкта», Invariants
