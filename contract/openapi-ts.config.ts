import { defineConfig } from '@hey-api/openapi-ts'

const input = './dist/openapi.json'

export default defineConfig([
  {
    input,
    output: {
      path: '../frontend/src/api/generated',
    },
    plugins: [
      {
        name: '@hey-api/client-fetch',
        // Ошибка API приходит исключением с телом ApiError: так её ловят и
        // TanStack Query, и обёртки в api/
        throwOnError: true,
        runtimeConfigPath: '../frontend/src/api/client.ts',
      },
      '@hey-api/typescript',
      '@hey-api/sdk',
      '@tanstack/react-query',
      'msw',
    ],
  },
  {
    input,
    output: {
      path: '../backend/src/generated',
      // Бекенд собирается с moduleResolution nodenext: импорты нужны с .js
      module: { extension: '.js' },
    },
    plugins: ['@hey-api/typescript', 'fastify'],
  },
])
