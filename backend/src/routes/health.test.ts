import { describe, expect, it } from 'vitest'
import { buildTestApp } from '../test/buildTestApp.js'

describe('GET /api/health', () => {
  it('отвечает status ok', async () => {
    const app = buildTestApp()
    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
