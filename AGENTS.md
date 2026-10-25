# AGENTS.md

Сервис записи на звонок (упрощённый Cal.com): владелец создаёт типы событий (название, описание, длительность) и видит все предстоящие бронирования одним списком, гость выбирает тип события и бронирует свободный слот в ближайшие 14 дней. Без авторизации, личного кабинета и интеграций с внешними календарями.

Требования к поведению сервиса: `docs/requirements.md`.

## Команды

Запускай только через make:

- `make setup` — установить зависимости и Chromium для e2e (`make e2e-install` ставит только Chromium)
- `make generate` — собрать OpenAPI из контракта и сгенерировать из него код; `dev`, `test`, `build` вызывают её сами
- `make dev` — бекенд на :3000 и фронтенд на :5173 (Vite проксирует `/api` на бекенд)
- `make test` — тесты Vitest: unit, маршруты, компоненты
- `make e2e` — сборка и e2e Playwright против собранного приложения; порт сервера — `E2E_PORT` (по умолчанию 3100): `make e2e E2E_PORT=3145`
- `make lint` / `make lint-fix` — oxlint и Prettier
- `make check` — lint + test + build (с `tsc`) + e2e, то же гоняет CI; запускай перед каждым коммитом
- `make docker-build` / `make docker-run` — образ и запуск на :3000

## Структура

- `contract/` — контракт API на TypeSpec (`main.tsp`). `make generate` собирает из него OpenAPI 3.0, а из OpenAPI hey-api (`contract/openapi-ts.config.ts`) генерирует код. Новый эндпоинт начинается с правки контракта (ADR 0005).
- Генерируемые пути (не коммитятся, руками не правятся; контракт меняется только в `contract/main.tsp`, затем `make generate`):
  - `contract/dist/openapi.json` — OpenAPI, по нему glue регистрирует маршруты;
  - `backend/src/generated/` — типы моделей (`types.gen.ts`) и `RouteHandlers` (`fastify.gen.ts`);
  - `frontend/src/api/generated/` — клиент fetch, типы, SDK (`sdk.gen.ts`), опции TanStack Query (`@tanstack/react-query.gen.ts`) и типизированные фабрики хендлеров MSW для тестов (`msw.gen.ts`).
- `backend/` — Fastify + TypeScript. `src/app.ts` собирает приложение (`buildApp`), `src/server.ts` только запускает его.
- `frontend/` — Vite + React + Mantine. Тесты рядом с кодом (`*.test.tsx`), общая обвязка тестов — `src/test/`.
- `e2e/` — сценарии Playwright, конфиг `playwright.config.ts` в корне.
- npm workspaces: зависимости ставь в свой пакет (`npm install <pkg> -w backend`).
- `CLAUDE.md` содержит только `@AGENTS.md`. Всё, что нужно добавить в `CLAUDE.md` (в том числе по инструкции скилла), добавляй в `AGENTS.md`.

## Архитектура

- Backend: `routes/` (обработчики операций контракта: вызов сервиса, ответ) → `services/` (бизнес-логика: слоты, бронирования) → `repositories/` (хранение данных). Маршруты не обращаются к хранилищу напрямую, только через сервисы. Маршруты и проверку запросов регистрирует `fastify-openapi-glue` по `operationId`, `app.get`/`app.post` для API не пишутся. Обработчик типизирован `RouteHandlers` и отвечает через `reply.code(n).send(...)`, ошибки — моделью `ApiError` (`backend/src/errors.ts`).
- Frontend: компоненты не вызывают `fetch` и SDK напрямую, запросы к API идут только через функции из `frontend/src/api/` — тонкие обёртки над сгенерированным SDK. Клиент настроен один раз в `frontend/src/api/client.ts`.
- В продакшене один контейнер: Fastify отдаёт API под `/api` и собранный фронтенд (`STATIC_DIR`). Все API-маршруты начинаются с `/api`.

## Образцы

- Маршрут: обработчик `backend/src/routes/owner.ts` (фабрика, получает зависимости аргументом), подключён в `serviceHandlers` в `backend/src/app.ts`; его тест через `app.inject()`: `backend/src/routes/owner.test.ts`. Приложение в тестах маршрутов собирает `buildTestApp` (`backend/src/test/buildTestApp.ts`): фиксированные `now` и пояс владельца, проверка ответов по контракту включена. Тесты ошибок API: `backend/src/errors.test.ts`.
- Запрос к API: `frontend/src/api/health.ts` (обёртка над SDK), его тест: `frontend/src/api/health.test.ts`.
- Тест компонента: `frontend/src/App.test.tsx`. Рендер — `renderApp(path)` из `frontend/src/test/renderApp.tsx` (`MantineProvider`, `MemoryRouter`, `QueryClientProvider` со своим клиентом без повторов). API подменяет MSW: `server.use(handleGetOwner({ body }))`, сервер — `frontend/src/test/server.ts`, фабрики — `api/generated/msw.gen.ts`; запрос без хендлера валит тест (`afterEach` в `frontend/src/setupTests.ts`), поэтому хендлеры нужны на все запросы открытых страниц, даже не важные тесту. `fetch` через `vi.stubGlobal` не подменяй. Процесс Vitest живёт в `TZ=Asia/Vladivostok`, владелец — в `Europe/Moscow`.
- E2E: `e2e/smoke.spec.ts`. Настоящий сервер без подмены API, данные готовь через фикстуру `request` (`request.post('/api/admin/event-types', { data })`), названия уникальны в каждом тесте.

## Как писать код

- Перед реализацией найди и обнови существующие типы, модели и helper-ы. Не создавай параллельные сущности.
- Не используй `any` и приведения `as`, чтобы заглушить ошибку типов: исправь исходный тип. Для фиксированных наборов значений используй union литералов.
- Делай только то, что просили: не переписывай и не «улучшай» соседний код. Рефакторинг не меняет поведение.
- Стек свежий, версии смотри в package.json. API библиотек сверяй с документацией этой версии, а не с памятью.
- Предпочитай популярные библиотеки и компоненты Mantine самописным решениям. Новые команды добавляй целью в Makefile.
- Комментарий объясняет, почему код написан именно так, а не что он делает.

## Баги и проверка

- Исправляй причину, а не следствие. Не прячь симптом через `?.`, try/catch, проверку на null или значение по умолчанию: найди, откуда пришли неверные данные.
- Баг: сначала тест, который его воспроизводит и падает, потом минимальная правка. Временные логи удали.
- Перед отчётом запусти `make check` и посмотри `git diff`: в нём только файлы, относящиеся к задаче.

## Git и безопасность

- Коммиты только по Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, `build:`, `refactor:`. По ним release-please собирает версию и changelog.
- Коммит, который закрывает тикет, ссылается на него номером в конце заголовка: `feat: book a free slot (#49)`. GitHub делает из номера ссылку, и по истории видно, какой коммит какую задачу делал.
- PR, в котором несколько тикетов, сливай merge-коммитом, а не squash: squash склеит коммиты в один, и ссылки на тикеты пропадут из истории `main`.
- Работай в отдельной ветке, не в `main`. Коммит, push и merge PR делай только после явного одобрения пользователя: когда `make check` зелёный, предложи и дождись ответа. В GitHub Actions действуют правила из раздела «Агент в GitHub Actions».
- Без явной просьбы не выполняй деструктивные команды (`rm -rf`, `git reset --hard`, `git push --force`, `git clean`). Не коммить секреты и `.env`.
- Не редактируй `.github/workflows/hexlet-check.yml`: его генерирует Хекслет.
- Если видишь изменения, которые ты не делал, игнорируй их.

## Агент в GitHub Actions

Раздел для запуска в GitHub Actions (`GITHUB_ACTIONS=true`): задачу дали комментарием `/oc`, `/opencode` или `/opus` в issue или PR. Воркфлоу — `.github/workflows/opencode.yml`. Новое issue от участника сначала оценивает `.github/workflows/opencode-triage.yml`: разбор комментарием и метка `critical` для ответственной задачи, по которой следующие `/oc` в треде идут на Opus. PR от людей ревьюит `.github/workflows/opencode-review.yml`: замечания комментарием, код не меняет. Пункты ниже — для работы по команде, автотриаж и авторевью действуют по `prompt` своих воркфлоу.

- Комментарий с командой и есть поручение пользователя, спросить его по ходу работы нельзя. Если задача неясна или требует решения человека, ничего не меняй и задай вопросы в ответе.
- Зависимости и Chromium воркфлоу ставит до запуска агента по `package-lock.json` из `main`: `make setup` не нужен, сразу `make test` и `make check`. Если ветка меняет `package.json` или `package-lock.json`, сначала выполни `npm install`.
- В shell-командах не переходи в подпапки через `cd`, пиши пути от корня репозитория: проверка разрешений считает относительные пути от корня, и `../..` из подпапки выглядит как путь за пределами репозитория. Такие пути запрещены, и команда не выполнится.
- Ветку и PR создаёт action: оставайся в текущей ветке, не переключай ветки, не делай push и не открывай PR. Изменения закоммить сам по Conventional Commits с номером тикета в конце заголовка, иначе action закоммитит их сообщением без типа и release-please их не увидит.
- PR не сливай и не одобряй: результат проверяет человек.
- Глубокий разбор передавай субагенту `analyst` (Opus): изменения через несколько слоёв (контракт → бекенд → фронтенд), доменная логика слотов, часовых поясов и пересечений бронирований, правка осознанного решения (ADR в `docs/adr`, правило в `GLOSSARY.md`, комментарий в коде со ссылкой на пункт спецификации вида `(26.2)`), причина неочевидного бага, безопасность и целостность данных. Передай ему полный текст задачи и обсуждения: тред issue он не видит. Он возвращает разбор и план, код по плану пишешь ты.
- В ответе одной строкой напиши, звал ли ты `analyst` и почему: по ней человек решает, повторить ли вызов с `@analyst`.
- Отвечай по-русски и коротко: что сделано, чем проверено, что осталось решить.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (pillboxru/ai-for-developers-project-387), managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
