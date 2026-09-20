---
id: T52
title: "Закрити завислі запуски підготовки"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2200
blocked_by: [T29]
blocks: [T32]
updated_at: "2026-09-20"
---

# T52 — Закрити завислі запуски підготовки

## Context

Знайдено 2026-09-19 у `critical-path-review` T28. Запуск, який вичерпав `retryLimit`, закриває
`PreparationService.abandon`: `failed` з `error_code: preparation_failed`
([events.md](../contracts/events.md), «Після вичерпаного `retryLimit`»). Але `abandon`
викликається лише з `catch` обробника в `worker.ts`, тож є два шляхи, де він не спрацьовує:

1. **Тайм-аут останньої спроби.** Процес `worker` упав посеред виклику моделі, або спроба
   триває довше за `expireInSeconds`. pg-boss позначає задачу простроченою без жодного
   `catch`, і на останній спробі нікому закрити запуск.
2. **Впав сам `abandon`.** Наприклад, обірвалося з'єднання з базою. Помилка `abandon` заміняє
   початкову, а запуск лишається як був.

В обох випадках запуск назавжди лишається `running` (або `queued`). Полінг фронту
([T32](add-preparation-ui.md)) ніколи не отримає завершення, і картка «вічно готується». Це та
сама діра AC-10, яку закрив `abandon`, лише на рідших шляхах.

## Sequence

Власного сценарію в [sad.md §6](../sad.md#6-runtime-view) немає. Задача закриває кінець
сценаріїв 5, 7 і 8, до якого обробник не дійшов:

> `worker->>pg: бере задачу`
> `anthropic--xworker: помилка після вичерпання спроб`

Після цього кроку запуск має стати завершеним, навіть коли `catch` обробника так і не
виконався. Це робить обхід у `worker`: він знаходить запуски в `queued`/`running`, старші за
повну серію спроб, і закриває їх як `failed / preparation_failed` без пропозицій.

## Data delta

| Що | Зміна |
|---|---|
| схема | не змінюється: `status`, `error_code`, `created_at`, `finished_at` вже є ([T26](add-preparation-tables-migration.md)) |
| `product_preparation_runs` | `queued`/`running` → `failed` з `preparation_failed`, коли `created_at` старший за поріг |
| індекс | вистачить наявного: завислих рядків одиниці |

**Поріг** — повна тривалість серії спроб, виведена з `config.queue.preparation`, а не окреме
число: `(retryLimit + 1) × expireInSeconds` плюс паузи між спробами з `retryDelaySeconds` і
`retryBackoff`, плюс запас на `pollingIntervalSeconds`. Оцінка «близько 16 хвилин», з якою
задачу писали, виявилась заниженою: pg-boss не повертає спроби в retry в мить, коли вийшов
`expireInSeconds` — це робить `failJobsByTimeout` у проході monitor, який тікає таймером
supervise і гейтиться `monitorIntervalSeconds` (обидва — 60 с). Тож кожна спроба може
чекати виявлення до двох цих інтервалів, і повна серія виходить ≈22,5 хвилини
(знахідка `critical-path-review`, 2026-09-20). Поріг мусить бути найгіршим випадком, а не
типовим: закрити живу спробу дорожче, ніж закрити мертву пізніше — оплачений виклик моделі
не потрапить у картку, бо `finishRun` уже не матчить guard статусу. Запуск `queued`, старший за поріг, теж
закривається: якщо його задача таки дійде до `worker` пізніше, `startRun` поверне `false` і
модель не викличеться. Константа, виведена з тих самих полів, не розійдеться з налаштуваннями
черги, коли їх змінять.

## API contract excerpt

```yaml
        status: { type: string, enum: [queued, running, succeeded, failed] }
```

```yaml
            `preparation_failed` — усі спроби задачі впали, пропозицій немає (AC-10, events.md).
```

Контракт не змінюється: завислий запуск закривається тим самим кодом, що й вичерпаний
`retryLimit`.

## Acceptance criteria

**AC-39** (US-03, US-04) — жоден запуск не висить вічно
**Given** запуск лишається `queued` чи `running` довше за повну серію спроб задачі
**When** проходить черговий обхід у `worker`
**Then** запуск завершується `failed` з `error_code: preparation_failed` без пропозицій, а
полінг отримує завершення (AC-10)

**AC-40** — живий запуск не чіпається
**Given** запуск `running`, молодший за поріг
**When** проходить обхід
**Then** запуск лишається як є. Завершені запуски (`succeeded`, `failed`) обхід не змінює
ніколи

## Checklist

1. `PreparationRepository` — один `UPDATE … WHERE status IN ('queued','running') AND
   created_at < now() - поріг`, що повертає кількість закритих. Той самий guard статусу, що й
   у `finishRun`, тож гонки з обробником, який саме завершує запуск, немає.
2. `src/config.ts` — поріг, виведений з `config.queue.preparation`, і період обходу.
3. `src/worker.ts` — періодичний обхід (`boss.schedule` чи інтервал pg-boss) з логом pino
   кількості закритих запусків.
4. `events.md` — прибрати «Відому межу», описати обхід.

## Out of scope

- Автоматичний повтор завислого запуску. Повтор лишається дією людини (AC-10, [T51](allow-retry-after-failed-run.md)).
- Моніторинг і алерти на завислі задачі pg-boss.

## DoD

- [x] AC-39: запуск `running`, старший за поріг, закривається `failed / preparation_failed` без
  пропозицій. Тест проти реальної бази.
- [x] AC-40: молодший за поріг `running` і будь-який завершений запуск лишаються незмінними.
  Тест проти реальної бази.
- [x] Поріг виведено з `config.queue.preparation`, а не записано окремим числом.
- [x] Смоук: запуск із `created_at` у минулому закривається першим же обходом живого `worker`.
- [x] Коміт: `fix(ai): close preparation runs left behind by a dead attempt`.

## Links

- [events.md](../contracts/events.md) · [T28](add-preparation-service.md) ·
  [T29](add-preparation-run-endpoints.md) · [T32](add-preparation-ui.md)
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-10
