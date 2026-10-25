# Календарь звонков (продолжение)

[![hexlet-check](https://github.com/pillboxru/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/pillboxru/ai-for-developers-project-387/actions)

Интегрируйте работу агентов в GitHub проект.

Продолжение проекта [«Календарь звонков»](https://github.com/pillboxru/ai-for-developers-project-386): приложение перенесено оттуда целиком, здесь агент работает внутри GitHub-процесса — в issue, pull request и по расписанию. План развития: [`docs/roadmap.md`](docs/roadmap.md).

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- Бекенд: [Fastify](https://fastify.dev/) + TypeScript
- Фронтенд: [Vite](https://vite.dev/) + React + [Mantine](https://mantine.dev/)
- Тесты: [Vitest](https://vitest.dev/), [MSW](https://mswjs.io/), e2e — [Playwright](https://playwright.dev/), линтер: [oxlint](https://oxc.rs/) + [Prettier](https://prettier.io/)
- Сборка и запуск: npm workspaces, GNU Make, Docker
- CI: GitHub Actions, релизы: [release-please](https://github.com/googleapis/release-please)

## Установка

Нужны Node.js 24, GNU Make и Docker. На Windows make ставится через [Scoop](https://scoop.sh/): `scoop install make`.

```bash
git clone https://github.com/pillboxru/ai-for-developers-project-387.git
cd ai-for-developers-project-387
make setup
```

`make setup` ставит зависимости и Chromium для e2e-тестов (отдельно Chromium ставит `make e2e-install`).

## Использование

```bash
make dev      # бекенд на http://localhost:3000, фронтенд на http://localhost:5173
make check    # линтер, тесты, сборка и e2e-тесты — то же, что гоняет CI
make e2e      # только e2e-тесты Playwright против собранного приложения
```

Контракт API описан на TypeSpec в `contract/main.tsp`. `make generate` собирает из него OpenAPI и генерирует SDK фронтенда и типы бекенда. `make dev`, `make test` и `make build` запускают генерацию сами, сгенерированные файлы в git не хранятся.

Запуск в Docker (приложение откроется на http://localhost:3000):

```bash
make docker-build
make docker-run
```

Порт задаётся переменной окружения `PORT` (по умолчанию `3000`). Имя владельца — `OWNER_NAME` (по умолчанию «Владелец календаря»), его часовой пояс — `OWNER_TIME_ZONE`, IANA-имя (по умолчанию `Europe/Moscow`); с неверным поясом сервер не стартует.

E2E-тесты поднимают сервер на порту `E2E_PORT` (по умолчанию `3100`): `make e2e E2E_PORT=3145`.

## Деплой

Версия из предыдущего проекта опубликована на Render: https://ai-for-developers-project-386-23sg.onrender.com/

Render собирает образ из `Dockerfile` и передаёт порт в переменной `PORT`. Бесплатный сервис засыпает без запросов, поэтому первый запрос после простоя может идти до минуты.

Данные хранятся в памяти процесса (ADR 0001): типы событий, расписание и бронирования сбрасываются при каждом перезапуске, новом деплое и засыпании сервиса.

### MCP Render для агента

Деплоем и проверкой сервиса агент управляет через [Render MCP](https://render.com/docs/mcp-server). Claude Code читает сервер из `.mcp.json` в корне репозитория. Этот файл содержит ключ и исключён из Git, в репозитории лежит шаблон `.mcp.json.example`.

1. Создайте API-ключ в Render: Account Settings → API Keys (https://dashboard.render.com/u/settings?add-api-key).
2. Скопируйте шаблон: `cp .mcp.json.example .mcp.json` и замените в `.mcp.json` `<RENDER_API_KEY>` на ключ.
3. Запустите `claude` в корне репозитория и одобрите сервер `render`. Проверка: `claude mcp list`.
4. Попросите агента выбрать рабочее пространство Render: «Set my Render workspace to <имя>».

Ключ даёт доступ ко всем сервисам аккаунта, в том числе к деплою и переменным окружения: не коммитьте `.mcp.json` и не вставляйте ключ в чат с агентом. Перед коммитом `git status` не должен показывать `.mcp.json`.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
