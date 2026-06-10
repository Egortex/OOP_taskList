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

| Файл                | Назначение                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `Router.ts`         | Ядро: перехват кликов/наведений, History API, рендер страниц, кэш, guard'ы, scroll restoration |
| `types.ts`          | Контракты: `PageModule`, `RouteDefinition`, `RouteContext`, `NavigateOptions`                  |
| `match.ts`          | Сопоставление шаблона маршрута (`/users/:id`) с реальным path                                  |
| `cache.ts`          | `PageCache` — TTL-кэш данных, загруженных через `loader`                                       |
| `session.ts`        | Хранение токена авторизации в `localStorage`                                                   |
| `renderTemplate.ts` | `mountTemplate()` — вставка HTML-шаблона и сбор `[ref]`-элементов                              |

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
8. Вызывается `cleanup` предыдущей страницы (если она его вернула), контейнер
   очищается, вызывается `page.render(container, data, ctx)`.
9. Восстанавливается прокрутка: при переходе вперёд/назад (`popstate`) —
   к сохранённой позиции, при обычной навигации — наверх страницы.
10. Статус навигации меняется на `success` или `error`.

**Перехват ссылок и prefetch**:

- Клик по любой `<a href="/...">` с тем же origin перехватывается
  (`onClick`) и превращается в `navigate()` без перезагрузки. Внешние ссылки,
  ссылки с `target`, `download`, модификаторами клавиш и `data-no-router` —
  не трогаются.
- При наведении на ссылку (`onMouseOver`) запускается `prefetch()` — данные
  страницы (через её `loader`) заранее кладутся в `PageCache`, чтобы переход
  был мгновенным.

### 2.3. Страницы — `app/pages/`

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

### 2.4. Компоненты — `app/components/`

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

### 2.5. Сервисы — `app/services/`

- **`ApiService`** — обёртка над `axios` для GET-запросов: автоматически
  отменяет предыдущий незавершённый запрос (`axios.CancelToken`),
  логирует ошибки, предоставляет `getUsers()`.

### 2.6. Стили — `app/assets/style/`

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
