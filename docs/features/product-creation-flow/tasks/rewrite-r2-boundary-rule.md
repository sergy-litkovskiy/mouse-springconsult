---
id: T02
title: "Переписати рядок про R2 в CLAUDE.md і ARCHITECTURE.md"
status: Todo
delivery: 0
gate_profile: docs
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: []
blocks: []
updated_at: "2026-09-05"
---

# T02 — Переписати рядок про R2 в `CLAUDE.md` і `ARCHITECTURE.md`

## Context

Рядок розділу «Чого НЕ робимо» — «Не зберігаємо зображення в БД і не проксуємо їх через
API — тільки R2 + presigned URL» — містить три твердження, і чинні з них не всі
([sad.md §11](../sad.md#11-risks-and-technical-debt)). Поки він стоїть як є, кожна задача
поставки 1, що пише кадр через API, формально порушує підписане правило.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1** — обидва напрямки в одній діаграмі, і
саме їхнє розрізнення й треба внести в текст правила:

> `api->>r2: кладе оригінал під ключем products/<картка>/<кадр>`   ← **запис іде через api**
> `web->>r2: читає кадр за цією адресою`   ← **читання йде повз api**

Ті самі дві стрілки продубльовані в C4 Container ([sad.md §5](../sad.md#5-building-block-view)):
`Rel(user, r2, "Читає кадри за постійною адресою, повз api")` і
`Rel(api, r2, "Кладе перевірений оригінал", "S3 API")`.

## Data delta

**Немає.** Правка двох документів рівня репозиторію.

## API contract excerpt

**Немає власного.** Наслідок правила видно у формі шляху завантаження — кадр іде **через**
API, а не в сховище напряму:

```yaml
  /products/{productId}/images:
    post:
      operationId: uploadProductImage
      requestBody:
        content:
          multipart/form-data:
```

Presigned-URL-варіант дав би тут `POST /products/{id}/images/upload-url`, і його в
контракті немає свідомо ([ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md)).

## Acceptance criteria

**AC (похідний від [PRD §6.1](../PRD.md#61-security--privacy), після правки [T01](align-prd-with-architecture.md))**
**Given** `user` відкриває картку з кадрами
**When** браузер запитує зображення
**Then** запит іде в R2 напряму, повз `api`, за постійною адресою

**AC (похідний від [ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md))**
**Given** `user` додає кадр
**When** файл надсилається
**Then** він проходить через `api`, який перевіряє його до запису в сховище — інакше перевірку виконати неможливо

## Checklist

1. `CLAUDE.md`, розділ «Чого НЕ робимо» — переписати рядок так, щоб він розрізняв читання й запис.
2. Прибрати з обох файлів формулювання «тільки presigned URL».
3. `ARCHITECTURE.md`, розділ «Межі, які тримаємо свідомо» — те саме формулювання, дослівно те саме.
4. В обох місцях дати посилання на ADR 0004 і ADR 0007 як на джерела правди.
5. Закреслити рядок `sad.md` §11 про це розходження з датою.

## Out of scope

- Будь-який код.
- `SPEC.md` — уже приведений у відповідність 2026-09-01.

## DoD

- [ ] Обидва файли розрізняють напрямок: читання йде повз API, запис — через API з перевіркою.
- [ ] Слів «тільки presigned URL» в обох файлах немає — перевірено `grep`.
- [ ] Формулювання в `CLAUDE.md` і `ARCHITECTURE.md` збігається дослівно: розійшовшись, вони знову почнуть суперечити одне одному.
- [ ] Коміт: `docs: split the R2 rule into read and write paths`.

## Links

- [sad.md §11](../sad.md#11-risks-and-technical-debt) · [sad.md §5](../sad.md#5-building-block-view)
- [ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md) · [ADR 0007](../adr/0007-serve-images-from-a-public-bucket.md)
- [CONTEXT.md](../CONTEXT.md) — «ключ обʼєкта»
