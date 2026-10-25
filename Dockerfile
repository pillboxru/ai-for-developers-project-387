# Этап 1: сборка бекенда и фронтенда
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Без package.json workspace npm ci молча не ставит его зависимости
COPY contract/package.json contract/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY . .
RUN npm run generate && npm run build

# Этап 2: лёгкий образ только с тем, что нужно для запуска
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend && npm cache clean --force

COPY --from=build /app/backend/dist backend/dist
# Маршруты и проверку запросов glue строит из контракта при старте
COPY --from=build /app/contract/dist/openapi.json contract/dist/openapi.json
COPY --from=build /app/frontend/dist public

USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
