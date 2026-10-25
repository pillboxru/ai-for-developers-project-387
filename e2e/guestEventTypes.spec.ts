import { expect, test, type APIRequestContext } from '@playwright/test'

async function createEventType(
  request: APIRequestContext,
  title: string,
  hidden: boolean,
) {
  const response = await request.post('/api/admin/event-types', {
    data: { title, durationMinutes: 90, slotStepMinutes: 30, hidden },
  })
  expect(response.ok()).toBe(true)
  const eventType: { id: string } = await response.json()
  return eventType
}

test('гость видит открытый тип в списке и открывает его страницу', async ({
  page,
  request,
}) => {
  const title = `Консультация ${Date.now()}`
  const eventType = await createEventType(request, title, false)

  await page.goto('/book')
  const card = page.getByRole('link', { name: new RegExp(`^${title}`) })
  await expect(card).toContainText('1 ч 30 мин')
  await card.click()

  await expect(page).toHaveURL(`/book/${eventType.id}`)
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible()
})

test('скрытого типа нет в списке, по прямой ссылке — «Тип события не найден»', async ({
  page,
  request,
}) => {
  const title = `Скрытый разбор ${Date.now()}`
  const eventType = await createEventType(request, title, true)
  // Видимый тип рядом: когда он на экране, список уже загружен, и отсутствие
  // скрытого — не просто ещё не пришедший ответ
  const visibleTitle = `Открытый разбор ${Date.now()}`
  await createEventType(request, visibleTitle, false)

  await page.goto('/book')
  await expect(
    page.getByRole('heading', { level: 2, name: visibleTitle }),
  ).toBeVisible()
  await expect(page.getByRole('main').getByText(title)).toHaveCount(0)

  await page.goto(`/book/${eventType.id}`)
  await expect(
    page.getByRole('heading', { name: 'Тип события не найден' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'К списку типов событий' }).click()
  await expect(page).toHaveURL('/book')
})
