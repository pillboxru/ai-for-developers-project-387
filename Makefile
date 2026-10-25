# Рецепты вызывают только npm и docker: так Makefile одинаково работает
# в PowerShell (cmd.exe), Git Bash и в CI на Ubuntu.

IMAGE = call-calendar

.PHONY: setup e2e-install generate dev test e2e lint lint-fix build check docker-build docker-run

setup: ## установить зависимости и Chromium для e2e
	npm install
	npm run e2e:install

# В CI (там задана CI=true) Chromium ставится вместе с системными библиотеками
e2e-install: ## скачать Chromium для Playwright
	npm run e2e:install -- $(if $(CI),--with-deps)

generate: ## OpenAPI из contract/main.tsp, из него SDK фронтенда и типы бекенда
	npm run generate

dev: generate ## бекенд (:3000) + фронтенд (:5173) в режиме разработки
	npm run dev

test: generate ## все тесты
	npm test

# Порт сервера задаёт E2E_PORT (по умолчанию 3100): make e2e E2E_PORT=3145
e2e: build ## e2e-тесты Playwright против собранного приложения
	npm run e2e

lint: ## oxlint + проверка форматирования
	npm run lint

lint-fix: ## автоисправление линтера и форматирование
	npm run lint:fix

build: generate ## сборка бекенда и фронтенда
	npm run build

check: lint test build e2e ## все проверки: линтер, тесты, сборка, e2e (то же гоняет CI)

docker-build: ## собрать Docker-образ
	docker build -t $(IMAGE) .

docker-run: ## запустить образ на http://localhost:3000
	docker run --rm --name $(IMAGE) -p 3000:3000 $(IMAGE)
