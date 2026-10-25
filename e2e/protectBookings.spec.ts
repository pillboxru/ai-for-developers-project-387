import { expect, test } from '@playwright/test'

// Тип с неотменённым бронированием нельзя ни удалить, ни переделать под
// другую длительность; после отмены защита снимается
test('бронирование защищает тип от удаления и смены длительности', async ({
  page,
  request,
}) => {
  const title = `Защита ${Date.now()}`
  const created = await request.post('/api/admin/event-types', {
    data: { title, durationMinutes: 30, slotStepMinutes: 30, hidden: false },
  })
  expect(created.ok()).toBe(true)
  const { id } = await created.json()
  const slots = await request.get(`/api/event-types/${id}/slots`)
  const { slots: list } = await slots.json()
  const booked = await request.post(`/api/event-types/${id}/bookings`, {
    data: {
      start: list[0].start,
      name: 'Иван Петров',
      email: 'ivan@example.com',
    },
  })
  expect(booked.ok()).toBe(true)
  const booking = await booked.json()

  await page.goto('/admin/event-types')
  const row = page.getByRole('row').filter({ hasText: title })
  await expect(row.getByRole('button', { name: 'Удалить' })).toBeDisabled()
  await row.getByRole('button', { name: 'Изменить' }).click()
  const modal = page.getByRole('dialog', { name: 'Изменить тип события' })
  await expect(
    modal.getByRole('combobox', { name: 'Длительность' }),
  ).toBeDisabled()
  await expect(
    modal.getByText(/Для другой длительности создайте новый тип/),
  ).toBeVisible()
  await modal.getByRole('button', { name: 'Отмена' }).click()

  const cancelled = await request.post(
    `/api/admin/bookings/${booking.id}/cancel`,
  )
  expect(cancelled.ok()).toBe(true)
  await page.reload()
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Удалить' }),
  ).toBeEnabled()
})
