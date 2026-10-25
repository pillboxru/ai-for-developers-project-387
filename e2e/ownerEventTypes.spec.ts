import { expect, test } from '@playwright/test'

// Сценарий 2: тип, созданный владельцем, появляется у гостя, а после
// скрытия пропадает из списка, и прямая ссылка на него ведёт в «не найден»
test('владелец создаёт тип — он у гостя; скрывает — у гостя пропал', async ({
  page,
  request,
}) => {
  const title = `Разбор кода ${Date.now()}`
  // Видимый тип рядом: когда он на экране, список гостя уже загружен, и
  // отсутствие скрытого — не просто ещё не пришедший ответ
  const neighbourTitle = `Знакомство ${Date.now()}`
  const neighbour = await request.post('/api/admin/event-types', {
    data: {
      title: neighbourTitle,
      durationMinutes: 30,
      slotStepMinutes: 30,
      hidden: false,
    },
  })
  expect(neighbour.ok()).toBe(true)

  await page.goto('/admin/event-types')
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Создать тип события' })
    .click()
  const createModal = page.getByRole('dialog', { name: 'Новый тип события' })
  await createModal.getByRole('textbox', { name: 'Название' }).fill(title)
  await createModal.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Тип события сохранён')).toBeVisible()

  await page.goto('/book')
  await page.getByRole('link', { name: new RegExp(`^${title}`) }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible()
  const eventTypeUrl = new URL(page.url()).pathname

  await page.goto('/admin/event-types')
  const row = page.getByRole('row').filter({ hasText: title })
  await row.getByRole('button', { name: 'Изменить' }).click()
  const editModal = page.getByRole('dialog', { name: 'Изменить тип события' })
  await editModal.getByRole('switch', { name: 'Показывать гостям' }).uncheck()
  await editModal.getByRole('button', { name: 'Сохранить' }).click()
  await expect(row.getByText('Скрыт')).toBeVisible()

  await page.goto('/book')
  await expect(
    page.getByRole('heading', { level: 2, name: neighbourTitle }),
  ).toBeVisible()
  await expect(page.getByRole('main').getByText(title)).toHaveCount(0)

  await page.goto(eventTypeUrl)
  await expect(
    page.getByRole('heading', { name: 'Тип события не найден' }),
  ).toBeVisible()
})
