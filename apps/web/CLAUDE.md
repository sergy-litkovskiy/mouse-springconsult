# Frontend (apps/web)

Продовження списку «Правила залежностей» з кореневого `CLAUDE.md` (пункти 1–9 —
межі модулів бекенду). Дотримуємось
[офіційного style guide Angular](https://angular.dev/style-guide).

10. Групуємо **за фічею**, а не за типом коду. Каталогів `components/`, `services/`,
    `directives/`, `pipes/`, `utils/`, `ui/`, `data-access/` не створюємо — це прямий
    анти-патерн з гайду.
11. Каталогів `core/` і `shared/` немає. Синглтони — це `providedIn: 'root'` у файлі
    поруч з фічею, якій вони належать; NgModule-епоха, що породила `core/`, закінчилась.
12. Фічі не імпортують одна одну. Коли щось знадобилось двом фічам — виносимо у файл
    з конкретним іменем на рівні `app/` (напр. `app/confirm-dialog.ts`), а не в `shared/`.
13. Типи запитів/відповідей беруться з `@contracts`. Дублювати інтерфейси DTO у web —
    заборонено.
14. Конфіг фронту — `@environments/environment`. Каталог лежить у застосунку
    (`apps/web/src/environments/`), як і вимагає `ng generate environments`;
    спільного на весь монорепо не буває — `fileReplacements` є механізмом білдера
    Angular, а `apps/api` збирається `tsc` і читає `process.env`.
    Angular підміняє файл при збірці
    (`fileReplacements` в `angular.json`): `environment.ts` — production,
    `environment.development.ts` — dev. Тримаємо там мінімум (`production`,
    `apiBaseUrl`); секретів у ньому не буває — все, що потрапляє в бандл, публічне.
    `environment.development.ts` у git не потрапляє, тому на чистому клоні його
    створюють вручну — зразок у README. `apiBaseUrl` дорівнює `/api` в обох
    оточеннях: у dev `ng serve` проксує `/api` на контейнер `api`
    (`proxy.conf.json`), тож origin один і CORS не потрібен ніде.
15. **Підфіча — вкладений каталог усередині фічі.** Заводимо його тоді, коли каталог
    фічі перестає читатись (гайд: _«As the number of files in a directory grows,
    consider splitting further into additional sub-directories»_), а не про запас.
    Ділити далі можна **тільки за фічею** — за екраном чи сценарієм (`products/catalog/`,
    `products/gallery/`, `products/form/`, `auth/login/`); правило 10 діє на будь-якій
    глибині, тож `products/components/` заборонене так само, як `app/components/`.
    На рівні фічі лишається те, що належить їй цілком, а не окремому екрану:
    `products/products-api.ts`, сесійний набір `auth/` (store, api, обидва guard-и,
    interceptor). Підфіча вільно імпортує сусідню всередині своєї фічі — `catalog`
    відкриває діалог з `gallery`, і це композиція батьківського екрана; заборона з
    правила 12 стосується лише меж **між** фічами.
