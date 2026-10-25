import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTestApp } from './test/buildTestApp.js'

describe('app', () => {
  it('раздаёт фронтенд из staticDir', async () => {
    const staticDir = mkdtempSync(path.join(tmpdir(), 'static-'))
    writeFileSync(path.join(staticDir, 'index.html'), '<div id="root"></div>')
    const app = buildTestApp({ staticDir })

    const root = await app.inject({ method: 'GET', url: '/' })
    expect(root.statusCode).toBe(200)
    expect(root.body).toContain('<div id="root">')

    const spaRoute = await app.inject({ method: 'GET', url: '/bookings' })
    expect(spaRoute.statusCode).toBe(200)
    expect(spaRoute.body).toContain('<div id="root">')

    const unknownApi = await app.inject({ method: 'GET', url: '/api/unknown' })
    expect(unknownApi.statusCode).toBe(404)
  })

  it('не собирается с неизвестным часовым поясом владельца', () => {
    expect(() => buildTestApp({ ownerTimeZone: 'Mars/Olympus' })).toThrow(
      'Неизвестный часовой пояс владельца «Mars/Olympus»: нужно IANA-имя, например Europe/Moscow',
    )
  })

  it('не собирается со смещением вместо пояса', () => {
    expect(() => buildTestApp({ ownerTimeZone: '+03:00' })).toThrow(
      'Часовой пояс владельца «+03:00» — смещение, а не IANA-имя: смещение не знает перевода часов. Нужно IANA-имя, например Europe/Moscow',
    )
  })

  // ICU разворачивает ссылки и новые имена в свои (Europe/Kyiv → Europe/Kiev),
  // но для IANA это то же место с теми же часами
  it.each(['Europe/Kyiv', 'Etc/UTC', 'US/Eastern'])(
    'собирается с IANA-именем %s, которое ICU пишет иначе',
    (ownerTimeZone) => {
      expect(() => buildTestApp({ ownerTimeZone })).not.toThrow()
    },
  )

  it('не собирается с именем пояса в другом регистре', () => {
    expect(() => buildTestApp({ ownerTimeZone: 'europe/moscow' })).toThrow(
      'Часовой пояс владельца «europe/moscow» записан не так, как в базе IANA: нужно «Europe/Moscow»',
    )
  })

  describe('проверка ответов по контракту', () => {
    // Плагином, а не app.get: так маршрут добавляется после плагинов
    // buildApp, как маршруты glue, и проверка ответов его видит
    function addOffContractRoute(app: ReturnType<typeof buildTestApp>) {
      app.register(async (instance) => {
        instance.get(
          '/api/test-off-contract',
          {
            schema: {
              response: {
                200: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string' } },
                  additionalProperties: { not: {} },
                },
              },
            },
          },
          async () => ({ status: 'ok', extra: true }),
        )
      })
    }

    it('включённая проверка превращает ответ не по контракту в 500', async () => {
      const app = buildTestApp({ validateResponses: true })
      addOffContractRoute(app)
      const response = await app.inject({
        method: 'GET',
        url: '/api/test-off-contract',
      })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toEqual({
        code: 'internal_error',
        message: expect.any(String),
      })
    })

    it('без проверки ответ уходит как есть', async () => {
      const app = buildTestApp({ validateResponses: false })
      addOffContractRoute(app)
      const response = await app.inject({
        method: 'GET',
        url: '/api/test-off-contract',
      })

      expect(response.statusCode).toBe(200)
    })
  })
})
