import { describe, expect, it } from 'vitest'
import { server } from '../test/server.ts'
import { handleGetHealth } from './generated/msw.gen.ts'
import { fetchHealth } from './health.ts'

describe('fetchHealth', () => {
  it('отдаёт статус сервера из /api/health', async () => {
    server.use(handleGetHealth({ body: { status: 'ok' } }))

    await expect(fetchHealth()).resolves.toEqual({ status: 'ok' })
  })
})
