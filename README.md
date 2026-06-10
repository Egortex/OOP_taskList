# OOP Task List

SPA-приложение со списком задач на Vanilla TypeScript: собственный клиентский роутер
(в духе React Router/Next.js), Express-сервер для API и статики, Tailwind CSS + SCSS
для стилей.

Подробное описание архитектуры — см. [ARCHITECTURE.md](./ARCHITECTURE.md).

## Стек

- **Vite 8** — сборка и dev-сервер клиента
- **TypeScript 6** (strict, без `any`)
- **Express 5** — API и раздача статики/SPA fallback
- **Tailwind CSS 4** + **SCSS** — стили
- **Vanilla TS SPA-роутер** — собственная реализация (History API, code splitting, кэш, guard'ы)

## Требования

- Node.js 22+
- npm

## Установка

```bash
npm install
```

## Разработка

Запускает одновременно клиент (Vite, порт 5173) и сервер (Express, порт 3001),
с проксированием `/api` с клиента на сервер:

```bash
npm run dev
```

Открыть http://localhost:5173

## Сборка и продакшн-запуск

```bash
npm run build   # сборка клиента в dist/
npm run start   # запуск Express-сервера (отдаёт dist/ + API)
```

Открыть http://localhost:3001

## Проверка типов

```bash
npm run typecheck
```

## Запуск через Docker

```bash
docker compose up --build
```

Приложение будет доступно на http://localhost:3001.

## Структура проекта

```
app/
  router/        # ядро SPA-роутера (Router, кэш, матчинг, layout'ы, типы)
  layouts/       # общие layout'ы (шапка/навигация), переиспользуются между страницами
  pages/         # страницы (file-based маршрутизация), у каждой свой .html/.scss/.page.ts
  components/    # переиспользуемые UI-компоненты (Component, TaskManager, SearchPanel, ...)
  forms/         # bindForm — единый слой валидации и обработки submit форм
  services/      # ApiService — обёртка над axios
  assets/style/  # глобальные стили (тема, Tailwind)
server/
  index.ts       # Express-приложение: API, статика, SPA fallback
  middleware/     # логгер запросов, проверка авторизации
  data/          # статичный контент страниц (home/about)
main.ts          # точка входа клиента
```

## Демо-авторизация

Для страницы `/login` используйте логин `admin` / пароль `admin`.
Токен хранится в `localStorage` и проверяется guard'ом страницы `/profile`.

## Дальнейшие задачи (TODO)

- ~~Сделать по нажатию на Enter добавление задачи~~ — готово (форма задач через `bindForm`)
- ~~Preload критичных маршрутов, skeleton-состояния, stale-while-revalidate~~ — готово (см. [ARCHITECTURE.md](./ARCHITECTURE.md#22-роутер--approuter))
- ~~Параллельная загрузка layout/page-модулей и отмена устаревших запросов через AbortSignal~~ — готово (см. [ARCHITECTURE.md](./ARCHITECTURE.md#22-роутер--approuter))
- ~~Вложенные маршруты / master-detail для `/users` → `/users/:id`~~ — готово (см. [ARCHITECTURE.md](./ARCHITECTURE.md#23-layouts--applayouts))
- Добавить поиск
- Добавить фильтрацию
