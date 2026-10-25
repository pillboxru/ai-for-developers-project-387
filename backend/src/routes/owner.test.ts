import { describe, expect, it } from 'vitest'
import { buildTestApp } from '../test/buildTestApp.js'

describe('GET /api/owner', () => {
  it('отдаёт имя и часовой пояс владельца из конфигурации', async () => {
    const app = buildTestApp({
      ownerName: 'Иван Петров',
      ownerTimeZone: 'Asia/Yekaterinburg',
    })
    const response = await app.inject({ method: 'GET', url: '/api/owner' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      name: 'Иван Петров',
      timeZone: 'Asia/Yekaterinburg',
    })
  })
})
