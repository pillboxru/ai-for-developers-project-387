import { expect, test, type Page } from '@playwright/test'

const months = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

// Кнопка даты в календаре гостя: «8 ноября 2026», по поясу браузера
function dayButtonName(instant: string, timeZone: string) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(instant))
    .split('-')
    .map(Number)
  return `${day} ${months[month - 1]} ${year}`
}

// Календарь открывается на месяце первой даты со слотами: нужная дата может
// быть в следующем
async function findDayButton(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true })
  await expect(
    page.getByRole('button', { name: 'Следующий месяц' }),
  ).toBeVisible()
  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: 'Следующий месяц' }).click()
  }
  return button
}

test('владелец закрывает день в расписании, и у гостя эта дата неактивна', async ({
  page,
  request,
}) => {
  // Воскресенье по умолчанию закрыто, и бронирований других сценариев на нём
  // нет. Открываем его 9:00–12:00 по Москве: это 16:00–19:00 во Владивостоке,
  // та же дата, а соседняя суббота закрыта — у гостя дата держится только
  // на воскресенье владельца
  const current = await request.get('/api/admin/schedule')
  const { weekly, overrides } = await current.json()
  const opened = await request.put('/api/admin/schedule', {
    data: {
      weekly: { ...weekly, sunday: [{ start: '09:00', end: '12:00' }] },
      overrides,
    },
  })
  expect(opened.ok()).toBe(true)

  const created = await request.post('/api/admin/event-types', {
    data: {
      title: `Воскресный звонок ${Date.now()}`,
      durationMinutes: 30,
      slotStepMinutes: 30,
      hidden: false,
    },
  })
  expect(created.ok()).toBe(true)
  const eventType: { id: string } = await created.json()
  const slotsResponse = await request.get(
    `/api/event-types/${eventType.id}/slots`,
  )
  const { slots }: { slots: { start: string }[] } = await slotsResponse.json()
  const sundaySlot = slots.find(
    (slot) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow',
        weekday: 'short',
      }).format(new Date(slot.start)) === 'Sun',
  )
  if (!sundaySlot) {
    throw new Error('Нет слота в воскресенье владельца')
  }
  const sunday = dayButtonName(sundaySlot.start, 'Asia/Vladivostok')

  await page.goto(`/book/${eventType.id}`)
  await expect(await findDayButton(page, sunday)).toBeEnabled()

  await page.goto('/admin/schedule')
  await page.getByRole('button', { name: 'Действия: Воскресенье' }).click()
  await page.getByRole('menuitem', { name: 'Очистить день' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Расписание сохранено')).toBeVisible()

  await page.goto(`/book/${eventType.id}`)
  await expect(await findDayButton(page, sunday)).toBeDisabled()
})
