import { expect, test } from '@playwright/test'

// Без файла SPA-fallback отдаёт на /robots.txt index.html, и поисковики
// читают HTML как robots.txt (#16)
test('robots.txt отдаётся текстом и разрешает индексацию', async ({
  request,
}) => {
  const response = await request.get('/robots.txt')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^text\/plain/)
  expect(await response.text()).toMatch(/^User-agent: \*$/m)
})
