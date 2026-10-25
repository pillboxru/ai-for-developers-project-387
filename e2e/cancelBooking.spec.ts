import { expect, test } from '@playwright/test'

test('владелец отменяет бронирование: карточка приглушена, время снова доступно гостю', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const title = `Отмена ${stamp}`
  const created = await request.post('/api/admin/event-types', {
    data: { title, durationMinutes: 30, slotStepMinutes: 30, hidden: false },
  })
  expect(created.ok()).toBe(true)
  const eventType: { id: string } = await created.json()
  // Время сервера не фиксируется: берём первый свободный слот
  const slotsResponse = await request.get(
    `/api/event-types/${eventType.id}/slots`,
  )
  const { slots }: { slots: { start: string }[] } = await slotsResponse.json()
  expect(slots.length).toBeGreaterThan(0)
  const [slot] = slots
  const firstGuest = `Отменённый гость ${stamp}`
  const booked = await request.post(
    `/api/event-types/${eventType.id}/bookings`,
    {
      data: {
        start: slot.start,
        name: firstGuest,
        email: `cancelled-${stamp}@example.com`,
      },
    },
  )
  expect(booked.ok()).toBe(true)

  await page.goto('/admin/bookings')
  const card = page.getByRole('article').filter({ hasText: firstGuest })
  await card.getByRole('button', { name: 'Отменить' }).click()
  const modal = page.getByRole('dialog', { name: 'Отменить бронирование?' })
  await expect(modal).toContainText(title)
  await expect(modal).toContainText(firstGuest)
  await modal.getByRole('button', { name: 'Отменить бронирование' }).click()

  await expect(page.getByText('Бронирование отменено')).toBeVisible()
  await expect(card).toContainText('Отменено')
  await expect(card).toHaveCSS('opacity', '0.6')
  await expect(card.getByRole('button', { name: 'Отменить' })).toHaveCount(0)
  await expect(
    card.getByRole('link', { name: `cancelled-${stamp}@example.com` }),
  ).toBeVisible()

  // Гость открывает то же время: оно снова свободно, и форма открывается
  await page.goto(`/book/${eventType.id}?slot=${slot.start}`)
  const secondGuest = `Новый гость ${stamp}`
  await page.getByRole('textbox', { name: /^Имя/ }).fill(secondGuest)
  await page
    .getByRole('textbox', { name: /^Email/ })
    .fill(`new-${stamp}@example.com`)
  await page.getByRole('button', { name: 'Забронировать' }).click()
  await expect(page.getByRole('heading', { name: 'Вы записаны' })).toBeVisible()

  // У владельца новое бронирование стоит рядом с отменённым
  await page.goto('/admin/bookings')
  const cards = page
    .getByRole('article')
    .filter({ hasText: new RegExp(`${firstGuest}|${secondGuest}`) })
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('Отменено')
  await expect(cards.nth(1)).toContainText(secondGuest)
  await expect(cards.nth(1)).not.toContainText('Отменено')
})
