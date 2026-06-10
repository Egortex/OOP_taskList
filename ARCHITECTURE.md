# Функциональная архитектура

## 1. Обзор

Приложение — одностраничное (SPA), но с серверной частью на Express, которая
отдаёт статику, выполняет SPA fallback и предоставляет небольшое REST API.
Навигация между "страницами" происходит на клиенте без перезагрузки браузера —
за это отвечает собственный роутер (`app/router`), вдохновлённый идеями
React Router и файловой маршрутизацией Next.js.

```
┌──────────────────────────┐        ┌──────────────────────────┐
│         Браузер          │        │       Express-сервер      │
│                           │  HTTP  │                           │
│  index.html + main.ts ───┼───────▶│  /api/*  — REST API        │
│        │                 │        │  /*      — статика dist/   │
│        ▼                 │        │           + SPA fallback   │
│   Router (app/router)     │        └──────────────────────────┘
│        │
│        ▼
│   Page module (app/pages/<route>/index.page.ts)
│        │
│        ▼
│   render() → DOM (через mountTemplate + *.html)
└──────────────────────────┘
```

## 2. Клиентская часть

### 2.1. Точка входа — `main.ts`

- Импортирует глобальные стили (`tailwind.css`, `style.scss`).
- Создаёт глобальные компоненты: `Preloader` (индикатор загрузки) и
  `Toaster` (всплывающие уведомления).
- Создаёт `Router` с реестром маршрутов `routes` и контейнером `#app`.
- Подписывается на смену статуса навигации (`loading` / `success` / `error`),
  показывая/скрывая прелоадер и проставляя `data-nav-status` на `<body>`
  (используется в `style.scss` для overlay/ошибок).
- Запускает роутер (`router.start()`).

### 2.2. Роутер — `app/router/`

| Файл                | Назначение                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Router.ts`         | Ядро: перехват кликов/наведений, History API, рендер страниц и layout'ов, кэш, guard'ы, scroll restoration |
| `types.ts`          | Контракты: `PageModule`, `RouteDefinition`, `RouteContext`, `NavigateOptions`, `LayoutModule`               |
| `match.ts`          | Сопоставление шаблона маршрута (`/users/:id`) с реальным path                                               |
| `cache.ts`          | `PageCache` — TTL-кэш данных, загруженных через `loader`                                                    |
| `session.ts`        | Хранение токена авторизации в `localStorage`                                                                |
| `renderTemplate.ts` | `mountTemplate()` — вставка HTML-шаблона и сбор `[ref]`-элементов                                            |

**Жизненный цикл навигации (`Router.render`)**:

1. Определяется текущий `pathname` → ищется подходящий маршрут (`resolve`),
   при отсутствии — берётся fallback `*` (страница 404).
2. Если у маршрута задан `redirectTo` — выполняется редирект (`navigate` с `replace: true`).
3. Строится `RouteContext` (path, params из `:param`, query из `URLSearchParams`).
4. Лениво подгружается модуль страницы (`route.load()`) — это даёт code splitting:
   каждая страница попадает в свой JS-чанк.
5. Если у страницы есть `guard` — он решает, можно ли показать страницу
   (например, `/profile` без токена редиректит на `/login`).
6. Если есть `loader` — данные берутся из `PageCache` либо запрашиваются заново
   и кладутся в кэш (TTL 30 секунд по умолчанию).
7. Защита от гонок: если за время загрузки была начата более новая навигация
   (`navId` изменился), результат отбрасывается.
8. `mountLayout()` гарантирует, что в контейнере смонтирован нужный layout
   (см. раздел [2.3](#23-layouts--applayouts)), и возвращает его `outlet` —
   элемент для рендера страницы. Повторная проверка `navId` после `await`.
9. Вызывается `cleanup` предыдущей страницы (если она его вернула), `outlet`
   очищается, вызывается `page.render(outlet, data, ctx)`.
10. Восстанавливается прокрутка: при переходе вперёд/назад (`popstate`) —
    к сохранённой позиции, при обычной навигации — наверх страницы.
11. Статус навигации меняется на `success` или `error`.

**Перехват ссылок и prefetch**:

- Клик по любой `<a href="/...">` с тем же origin перехватывается
  (`onClick`) и превращается в `navigate()` без перезагрузки. Внешние ссылки,
  ссылки с `target`, `download`, модификаторами клавиш и `data-no-router` —
  не трогаются.
- При наведении на ссылку (`onMouseOver`) запускается `prefetch()` — данные
  страницы (через её `loader`) заранее кладутся в `PageCache`, чтобы переход
  был мгновенным.

### 2.3. Layouts — `app/layouts/`

Layout — общая обвязка вокруг группы страниц (шапка, навигация и т.п.), которая
не пересоздаётся при переходах внутри своей секции.

`LayoutModule` (см. `router/types.ts`):

- `render(container, ctx): LayoutRenderResult` — монтирует разметку layout'а в
  контейнер и возвращает:
  - `outlet` — элемент, в который роутер будет рендерить текущую страницу;
  - `update?(ctx)` — вызывается при каждой навигации, если layout не
    пересоздаётся (используется для подсветки активного пункта меню);
  - `cleanup?()` — вызывается перед размонтированием layout'а при переходе на
    маршрут с другим layout'ом.

`RouteDefinition.layout?: LayoutLoader` — ленивая загрузка модуля layout'а
(`() => import(...)`). **Важно**: для всех маршрутов одной секции нужно
передавать **одну и ту же функцию-ссылку** — роутер сравнивает
`layoutLoader` предыдущего и нового маршрута по ссылке (`===`), и только если
она изменилась, пересоздаёт layout. Поэтому в `app/pages/routes.ts` объявлена
одна константа `mainLayout: LayoutLoader`, переданная во все маршруты.

**`app/layouts/main/`** — единственный на данный момент layout:

- `index.html` / `index.scss` — шапка `.site-header` с навигацией `.site-nav`
  (перенесены из корневого `index.html`) и контейнер `.app-content` с `ref="outlet"`.
- `index.layout.ts` — при монтировании и при каждом `update(ctx)` подсвечивает
  ссылку, соответствующую `ctx.path`, классом `.site-nav__link--active`.

Алгоритм `Router.mountLayout(layoutLoader, ctx)`:

1. Если `layoutLoader === this.currentLayoutLoader` и layout уже смонтирован —
   просто вызвать `update(ctx)` и вернуть текущий `outlet`.
2. Иначе — выполнить `cleanup` текущей страницы и layout'а, очистить контейнер,
   лениво загрузить новый layout (если `layoutLoader` задан) и смонтировать его,
   вернуть его `outlet` (либо сам контейнер, если у маршрута нет layout'а).

### 2.4. Страницы — `app/pages/`

Файловая маршрутизация: каждая страница — отдельная папка с тремя файлами:

```
app/pages/<route>/
  index.page.ts   # логика: PageModule (loader/guard/render)
  index.html      # разметка с [ref]-атрибутами (?raw импорт)
  index.scss      # стили страницы
```

Реестр маршрутов — `app/pages/routes.ts`. Каждый маршрут лениво импортирует
свой `index.page.ts` (`load: () => import("./<route>/index.page")`).

`PageModule<TData>` (см. `types.ts`):

- `loader?(ctx)` — асинхронно получает данные для страницы (например, `fetch`);
  результат кэшируется роутером.
- `guard?(ctx)` — проверяет доступ; при `false` сам выполняет редирект.
- `render(container, data, ctx)` — монтирует `index.html` через `mountTemplate`,
  заполняет `[ref]`-элементы данными, вешает обработчики; может вернуть
  функцию `cleanup`.

| Маршрут      | Страница     | Особенности                                              |
| ------------ | ------------ | -------------------------------------------------------- |
| `/`          | `home`       | Статический контент с сервера (`/api/pages/home`)        |
| `/about`     | `about`      | Контент с сервера + демонстрация query-параметра `?ref=` |
| `/users`     | `users`      | Список пользователей (jsonplaceholder API)               |
| `/users/:id` | `users/[id]` | Детали пользователя, параметр маршрута `:id`             |
| `/tasks`     | `tasks`      | Список задач (`TaskManager` + `SearchPanel`)             |
| `/login`     | `login`      | Форма логина, демо `admin`/`admin`, сохраняет токен      |
| `/profile`   | `profile`    | Защищена `guard`, требует токен, кнопка выхода           |
| `*`          | `notFound`   | Страница 404                                             |

### 2.5. Компоненты — `app/components/`

Базовый класс `Component<TRefs>` (`component.ts`):

- Принимает `placeholderId` (ID контейнера в DOM), `props` (`events`, `data`)
  и опциональный HTML-шаблон.
- Вставляет шаблон, собирает элементы с атрибутом `[ref]` в `this.refs`
  (типизировано через generic `TRefs`).
- Навешивает обработчики из `props.events` на корневой элемент.
- `triggerEvent(name, detail, options)` — диспатчит `CustomEvent` для общения
  с родительским кодом (например, `tasks/index.page.ts` слушает `toast`,
  `onLoader`, `offLoader` от `TaskManager`).

Компоненты:

- **`Preloader`** — глобальный оверлей загрузки, управляется через
  `visiblePreloader()` / `notVisiblePreloader()`. Подписан на статус роутера.
- **`Toaster`** — глобальный контейнер всплывающих уведомлений,
  `showToast(message, duration)`.
- **`TaskManager`** — список задач: хранение в `localStorage`, добавление
  (`addTask`), удаление (`deleteTask`), переключение статуса
  (`toggleCompleted`), поиск (`searchTasks`), подгрузка пользователей как
  задач через `ApiService.getUsers()`.
- **`SearchPanel`** — поле поиска, фильтрует задачи через `TaskManager` и
  перерисовывает список.
- **`Task`** — модель данных задачи (`id`, `title`, `isCompleted`, `priority`).

### 2.6. Формы — `app/forms/`

`bindForm<TField>(form, options)` (`bindForm.ts`) — единый слой обработки
HTML-форм, используется вместо ручных `addEventListener("click"/"submit", ...)`:

- Подписывается на `submit` формы (включая отправку по **Enter**) и вызывает
  `event.preventDefault()`.
- Валидирует поля по `schema: Record<TField, FieldRule>`:
  - `required?: string` — сообщение об ошибке, если поле пустое после `trim()`;
  - `pattern?: { value: RegExp; message: string }` — проверка регулярным
    выражением (только для непустых полей).
- При первой ошибке показывает её в `options.errorElement` (через
  `textContent` + снятие/установку `hidden`), `onSubmit` не вызывается.
- При успешной валидации собирает `FormValues<TField>` (имя поля → строка из
  `FormData`, по атрибуту `name`) и вызывает `onSubmit(values, form)`.
- `resetOnSuccess?: boolean` — сбрасывает форму после успешного `onSubmit`.
- Возвращает функцию отписки от `submit` (можно использовать как `cleanup`
  страницы/компонента).

Используется в:

- **`login`** (`app/pages/login/index.page.ts`) — валидация `username`/`password`,
  `onSubmit` шлёт `/api/login`, при ошибке показывает сообщение в `refs.error`.
- **`TaskManager`** (`app/components/task/TaskManager.ts`) — форма добавления
  задачи (`title`/`priority`); `onSubmit` вызывает `addTask(title, priority)`,
  `resetOnSuccess: true` очищает поле ввода. Благодаря `<form>` задачу теперь
  можно добавить нажатием **Enter**.

### 2.7. Сервисы — `app/services/`

- **`ApiService`** — обёртка над `axios` для GET-запросов: автоматически
  отменяет предыдущий незавершённый запрос (`axios.CancelToken`),
  логирует ошибки, предоставляет `getUsers()`.

### 2.8. Стили — `app/assets/style/`

- `tailwind.css` — точка входа Tailwind (`@import "tailwindcss"`).
- `style.scss` — тёмная тема через CSS custom properties (`--color-*`),
  базовые сбросы, стили шапки/навигации, индикаторы статуса навигации
  (`body[data-nav-status="loading"|"error"]`).
- У каждой страницы и компонента — собственный `*.scss`, использующий
  переменные темы.

## 3. Серверная часть — `server/`

| Файл                   | Назначение                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| `index.ts`             | Express-приложение: middleware, API-роуты, статика, SPA fallback |
| `middleware/logger.ts` | Логирование метода/URL/статуса/времени каждого запроса           |
| `middleware/auth.ts`   | `requireAuth` — проверка `Authorization: Bearer <token>`         |
| `data/pages.ts`        | Статичный контент для `/api/pages/:name` (home, about)           |

### API

- `GET /api/pages/:name` — отдаёт контент страницы (`home`/`about`) для
  соответствующих `loader`'ов на клиенте.
- `POST /api/login` — демо-логин (`admin`/`admin`), возвращает
  `{ token, user }`.
- `GET /api/me` — данные текущего пользователя, требует
  `Authorization: Bearer demo-token` (middleware `requireAuth`).

### Статика и SPA fallback

- Если есть собранный `dist/` — раздаётся через `express.static`.
- Любой не-API `GET`-запрос, не попавший на статический файл, получает
  `dist/index.html` — клиентский роутер сам определяет, какую страницу
  показать на основе URL.

## 4. Сборка и инфраструктура

- **Vite** (`vite.config.ts`) — сборка клиента, плагин `@tailwindcss/vite`,
  прокси `/api → http://localhost:3001` в dev-режиме.
- **tsconfig.json** / **tsconfig.server.json** — раздельные конфиги для
  клиента (DOM lib) и сервера (Node lib), оба строгие, без `any`.
- **Docker**: `Dockerfile` — многоэтапная сборка (сборка клиента → копирование
  `dist/` и `server/` в финальный образ, запуск через `tsx`);
  `docker-compose.yml` — поднимает приложение на порту 3001.
