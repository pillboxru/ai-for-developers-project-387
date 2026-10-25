import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleGetOwner,
  handleGetSchedule,
  handleListBookings,
  handleUpdateSchedule,
} from '../../api/generated/msw.gen.ts'
import type {
  ApiError,
  Booking,
  Schedule,
  UpdateSchedule,
  WeeklySchedule,
} from '../../api/generated/types.gen.ts'
import { renderApp } from '../../test/renderApp.tsx'
import { server } from '../../test/server.ts'

// Сегодня понедельник 2 ноября, 09:00 по Москве; браузер во Владивостоке
const today = new Date('2026-11-02T06:00:00Z')
const bookingWindow = {
  start: '2026-11-01T21:00:00Z',
  end: '2026-11-15T21:00:00Z',
}

const workday = [{ start: '09:00', end: '18:00' }]
const defaultWeekly: WeeklySchedule = {
  monday: workday,
  tuesday: workday,
  wednesday: workday,
  thursday: workday,
  friday: workday,
  saturday: [],
  sunday: [],
}

const defaultSchedule: Schedule = {
  weekly: defaultWeekly,
  overrides: [],
  bookingWindow,
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: crypto.randomUUID(),
    eventType: {
      id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11',
      title: 'Консультация',
      hidden: false,
    },
    // Вторник 3 ноября, 10:00–10:30 по Москве
    start: '2026-11-03T07:00:00Z',
    end: '2026-11-03T07:30:00Z',
    name: 'Иван Петров',
    email: 'ivan@example.com',
    cancelled: false,
    ...overrides,
  }
}

function serveEditor({
  schedule = defaultSchedule,
  bookings = [],
}: { schedule?: Schedule; bookings?: Booking[] } = {}) {
  server.use(
    handleGetOwner({
      body: { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' },
    }),
    handleGetSchedule({ body: schedule }),
    handleListBookings({ body: bookings }),
  )
}

// Ячейка матрицы: день недели и получас по часам владельца
const cell = (day: string, time: string) =>
  screen.getByRole('gridcell', { name: `${day}, ${time}` })

const isOpen = (day: string, time: string) =>
  cell(day, time).getAttribute('aria-selected') === 'true'

// Протягивание мышью от одной ячейки до другой
function drag(from: HTMLElement, to: HTMLElement) {
  fireEvent.mouseDown(from)
  fireEvent.mouseEnter(to)
  fireEvent.mouseUp(to)
}

function dayMenu(day: string, item: string) {
  fireEvent.click(screen.getByRole('button', { name: `Действия: ${day}` }))
  fireEvent.click(screen.getByRole('menuitem', { name: item }))
}

async function openEditor() {
  renderApp('/admin/schedule')
  return screen.findByRole('grid', { name: 'Неделя' })
}

beforeEach(() => {
  vi.setSystemTime(today)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('редактор расписания', () => {
  it('матрица с понедельника, 06:00–23:00, открыто время из расписания по поясу владельца', async () => {
    serveEditor()
    const grid = await openEditor()

    const columns = within(grid)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(columns).toEqual(['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'])
    expect(cell('Понедельник', '06:00')).toBeInTheDocument()
    expect(cell('Понедельник', '22:30')).toBeInTheDocument()
    expect(
      screen.queryByRole('gridcell', { name: 'Понедельник, 05:30' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('gridcell', { name: 'Понедельник, 23:00' }),
    ).not.toBeInTheDocument()
    expect(isOpen('Понедельник', '09:00')).toBe(true)
    expect(isOpen('Пятница', '17:30')).toBe(true)
    expect(isOpen('Понедельник', '08:30')).toBe(false)
    expect(isOpen('Понедельник', '18:00')).toBe(false)
    expect(isOpen('Суббота', '12:00')).toBe(false)
    expect(
      screen.getByText('Время по поясу владельца: Europe/Moscow'),
    ).toBeInTheDocument()
  })

  it('«Ночные часы» показывают сутки', async () => {
    serveEditor({
      schedule: {
        ...defaultSchedule,
        weekly: {
          ...defaultWeekly,
          sunday: [{ start: '23:00', end: '24:00' }],
        },
      },
    })
    await openEditor()

    fireEvent.click(screen.getByRole('switch', { name: 'Ночные часы' }))

    expect(cell('Понедельник', '00:00')).toBeInTheDocument()
    expect(isOpen('Воскресенье', '23:30')).toBe(true)
    expect(isOpen('Воскресенье', '22:30')).toBe(false)
  })

  it('протягивание от открытой ячейки закрывает прямоугольник', async () => {
    serveEditor()
    await openEditor()

    drag(cell('Понедельник', '09:00'), cell('Вторник', '10:00'))

    for (const day of ['Понедельник', 'Вторник']) {
      expect(isOpen(day, '09:00')).toBe(false)
      expect(isOpen(day, '09:30')).toBe(false)
      expect(isOpen(day, '10:00')).toBe(false)
      expect(isOpen(day, '10:30')).toBe(true)
    }
    expect(isOpen('Среда', '09:00')).toBe(true)
  })

  it('протягивание от закрытой ячейки открывает прямоугольник, снизу вверх тоже', async () => {
    serveEditor()
    await openEditor()

    drag(cell('Воскресенье', '11:00'), cell('Суббота', '10:00'))

    for (const day of ['Суббота', 'Воскресенье']) {
      expect(isOpen(day, '09:30')).toBe(false)
      expect(isOpen(day, '10:00')).toBe(true)
      expect(isOpen(day, '10:30')).toBe(true)
      expect(isOpen(day, '11:00')).toBe(true)
      expect(isOpen(day, '11:30')).toBe(false)
    }
    expect(isOpen('Пятница', '08:00')).toBe(false)
  })

  it('щелчок по одной ячейке переключает её', async () => {
    serveEditor()
    await openEditor()

    drag(cell('Суббота', '12:00'), cell('Суббота', '12:00'))

    expect(isOpen('Суббота', '12:00')).toBe(true)
    expect(isOpen('Суббота', '12:30')).toBe(false)
  })

  describe('меню дня', () => {
    // Понедельник 10:00–12:00, остальные будни 9:00–18:00
    const custom = {
      ...defaultSchedule,
      weekly: { ...defaultWeekly, monday: [{ start: '10:00', end: '12:00' }] },
    }

    it('«Копировать на» → «Все будни» заменяет будни, выходные не трогает', async () => {
      serveEditor({ schedule: custom })
      await openEditor()

      dayMenu('Понедельник', 'Все будни')

      for (const day of ['Вторник', 'Среда', 'Четверг', 'Пятница']) {
        expect(isOpen(day, '09:30')).toBe(false)
        expect(isOpen(day, '10:00')).toBe(true)
        expect(isOpen(day, '11:30')).toBe(true)
        expect(isOpen(day, '12:00')).toBe(false)
      }
      expect(isOpen('Суббота', '10:00')).toBe(false)
    })

    it('«Копировать на» → «Все дни» заменяет всю неделю', async () => {
      serveEditor({ schedule: custom })
      await openEditor()

      dayMenu('Понедельник', 'Все дни')

      expect(isOpen('Суббота', '10:00')).toBe(true)
      expect(isOpen('Воскресенье', '11:30')).toBe(true)
      expect(isOpen('Вторник', '09:00')).toBe(false)
    })

    it('«Копировать на» конкретный день', async () => {
      serveEditor({ schedule: custom })
      await openEditor()

      dayMenu('Понедельник', 'Суббота')

      expect(isOpen('Суббота', '10:00')).toBe(true)
      expect(isOpen('Воскресенье', '10:00')).toBe(false)
      expect(isOpen('Вторник', '09:00')).toBe(true)
    })

    it('«Очистить день» закрывает весь день', async () => {
      serveEditor()
      await openEditor()

      dayMenu('Среда', 'Очистить день')

      expect(isOpen('Среда', '09:00')).toBe(false)
      expect(isOpen('Среда', '17:30')).toBe(false)
      expect(isOpen('Четверг', '09:00')).toBe(true)
    })
  })

  describe('черновик', () => {
    const saveButton = () => screen.getByRole('button', { name: 'Сохранить' })
    const cancelButton = () => screen.getByRole('button', { name: 'Отменить' })

    it('без правок кнопки выключены, правка включает их', async () => {
      serveEditor()
      await openEditor()

      expect(saveButton()).toBeDisabled()
      expect(cancelButton()).toBeDisabled()

      dayMenu('Среда', 'Очистить день')

      expect(
        screen.getByText('Есть несохранённые изменения'),
      ).toBeInTheDocument()
      expect(saveButton()).toBeEnabled()
      expect(cancelButton()).toBeEnabled()
    })

    it('«Отменить» возвращает сохранённое расписание', async () => {
      serveEditor()
      await openEditor()
      dayMenu('Среда', 'Очистить день')

      fireEvent.click(cancelButton())

      expect(isOpen('Среда', '09:00')).toBe(true)
      expect(saveButton()).toBeDisabled()
      expect(
        screen.queryByText('Есть несохранённые изменения'),
      ).not.toBeInTheDocument()
    })

    it('«Сохранить» отправляет неделю промежутками и исключения, уведомляет', async () => {
      const overrides = [
        { date: '2026-10-30', ranges: [] },
        { date: '2026-11-20', ranges: [{ start: '10:00', end: '12:00' }] },
      ]
      const sent: UpdateSchedule[] = []
      serveEditor({ schedule: { ...defaultSchedule, overrides } })
      server.use(
        handleUpdateSchedule(async ({ request }) => {
          const body = await request.json()
          sent.push(body)
          return HttpResponse.json({ ...body, bookingWindow })
        }),
      )
      await openEditor()
      dayMenu('Среда', 'Очистить день')
      // Суббота 10:00–11:00 и 11:00–12:00 сливаются в один промежуток
      drag(cell('Суббота', '10:00'), cell('Суббота', '10:30'))
      drag(cell('Суббота', '11:00'), cell('Суббота', '11:30'))
      drag(cell('Воскресенье', '22:00'), cell('Воскресенье', '22:30'))
      fireEvent.click(screen.getByRole('switch', { name: 'Ночные часы' }))
      drag(cell('Воскресенье', '23:00'), cell('Воскресенье', '23:30'))

      fireEvent.click(saveButton())

      expect(
        await screen.findByText('Расписание сохранено'),
      ).toBeInTheDocument()
      expect(sent).toEqual([
        {
          weekly: {
            ...defaultWeekly,
            wednesday: [],
            saturday: [{ start: '10:00', end: '12:00' }],
            sunday: [{ start: '22:00', end: '24:00' }],
          },
          overrides,
        },
      ])
      expect(saveButton()).toBeDisabled()
      expect(isOpen('Суббота', '11:30')).toBe(true)
    })

    it('сбой сохранения: уведомление, черновик остаётся', async () => {
      serveEditor()
      server.use(
        handleUpdateSchedule(() =>
          HttpResponse.json<ApiError>(
            { code: 'internal_error', message: 'Внутренняя ошибка сервера' },
            { status: 500 },
          ),
        ),
      )
      await openEditor()
      dayMenu('Среда', 'Очистить день')

      fireEvent.click(saveButton())

      expect(
        await screen.findByText('Не удалось сохранить. Попробуйте ещё раз.'),
      ).toBeInTheDocument()
      expect(isOpen('Среда', '09:00')).toBe(false)
      expect(saveButton()).toBeEnabled()
    })
  })

  it('полоски предстоящих бронирований окна записи на датах без исключений, с подсказкой', async () => {
    serveEditor({
      schedule: {
        ...defaultSchedule,
        overrides: [
          { date: '2026-11-05', ranges: [{ start: '10:00', end: '11:00' }] },
        ],
      },
      bookings: [
        booking(),
        // Вторник 10 ноября, 10:00–11:00 по Москве
        booking({
          start: '2026-11-10T07:00:00Z',
          end: '2026-11-10T08:00:00Z',
          name: 'Мария Котова',
        }),
        booking({
          start: '2026-11-04T07:00:00Z',
          end: '2026-11-04T07:30:00Z',
          name: 'Отменённый гость',
          cancelled: true,
        }),
        // Четверг 5 ноября — дата с исключением
        booking({
          start: '2026-11-05T07:00:00Z',
          end: '2026-11-05T07:30:00Z',
          name: 'Гость в исключении',
        }),
        // Пятница 20 ноября — за окном записи
        booking({
          start: '2026-11-20T07:00:00Z',
          end: '2026-11-20T07:30:00Z',
          name: 'Гость за окном',
        }),
      ],
    })
    await openEditor()

    fireEvent.mouseEnter(cell('Вторник', '10:00'))
    expect(
      await screen.findByText('вт, 3 ноября, 10:00–10:30 · Иван Петров'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('вт, 10 ноября, 10:00–11:00 · Мария Котова'),
    ).toBeInTheDocument()
    fireEvent.mouseLeave(cell('Вторник', '10:00'))

    fireEvent.mouseEnter(cell('Вторник', '10:30'))
    await waitFor(() =>
      expect(screen.queryByText(/Иван Петров/)).not.toBeInTheDocument(),
    )
    expect(screen.getByText(/Мария Котова/)).toBeInTheDocument()

    for (const [day, time] of [
      ['Среда', '10:00'],
      ['Четверг', '10:00'],
      ['Пятница', '10:00'],
    ]) {
      fireEvent.mouseEnter(cell(day, time))
    }
    expect(screen.queryByText(/Отменённый гость/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Гость в исключении/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Гость за окном/)).not.toBeInTheDocument()
  })

  describe('конфликт с бронированиями', () => {
    const line = 'вт, 3 ноября, 10:00–10:30 — Иван Петров (Консультация)'
    const alertTitle =
      'Так сохранить нельзя: бронирования окажутся вне доступного времени'

    it('черновик конфликтует: Alert со списком, «Сохранить» открывает «Сохранить нельзя» без запроса', async () => {
      serveEditor({
        bookings: [
          booking(),
          booking({ name: 'Отменённый гость', cancelled: true }),
        ],
      })
      await openEditor()
      expect(screen.queryByText(alertTitle)).not.toBeInTheDocument()

      dayMenu('Вторник', 'Очистить день')

      const alert = screen.getByRole('alert')
      expect(within(alert).getByText(alertTitle)).toBeInTheDocument()
      expect(within(alert).getByText(line)).toBeInTheDocument()
      expect(
        within(alert).queryByText(/Отменённый гость/),
      ).not.toBeInTheDocument()

      // Хендлера сохранения нет: запрос уронил бы тест
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
      const dialog = await screen.findByRole('dialog', {
        name: 'Сохранить нельзя',
      })
      expect(within(dialog).getByText(line)).toBeInTheDocument()

      fireEvent.click(within(dialog).getByRole('button', { name: 'Понятно' }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
      expect(isOpen('Вторник', '10:00')).toBe(false)
    })

    it('черновик, который снова оставляет время бронированию, убирает Alert', async () => {
      serveEditor({ bookings: [booking()] })
      await openEditor()
      dayMenu('Вторник', 'Очистить день')

      drag(cell('Вторник', '10:00'), cell('Вторник', '10:00'))

      expect(screen.queryByText(alertTitle)).not.toBeInTheDocument()
    })

    it('409 от сервера: «Сохранить нельзя» со списком сервера, бронирования перечитываются', async () => {
      const known: Booking[] = []
      serveEditor()
      server.use(
        handleListBookings(() => HttpResponse.json(known)),
        handleUpdateSchedule(() => {
          // Гость успел забронировать, пока владелец правил черновик
          known.push(booking())
          return HttpResponse.json<ApiError>(
            {
              code: 'schedule_conflicts_with_bookings',
              message: 'Бронирования окажутся вне доступного времени.',
              bookings: known,
            },
            { status: 409 },
          )
        }),
      )
      await openEditor()
      dayMenu('Вторник', 'Очистить день')

      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

      const dialog = await screen.findByRole('dialog', {
        name: 'Сохранить нельзя',
      })
      expect(within(dialog).getByText(line)).toBeInTheDocument()
      expect(await screen.findByText(alertTitle)).toBeInTheDocument()
      expect(
        screen.queryByText('Не удалось сохранить. Попробуйте ещё раз.'),
      ).not.toBeInTheDocument()
    })
  })
})

describe('исключения на даты', () => {
  const column = () => screen.getByRole('region', { name: 'Исключения' })
  const card = (date: string) =>
    within(column()).getByRole('article', { name: date })

  // Сохранение отвечает тем, что пришло: тела запросов копятся в sent
  function serveSave() {
    const sent: UpdateSchedule[] = []
    server.use(
      handleUpdateSchedule(async ({ request }) => {
        const body = await request.json()
        sent.push(body)
        return HttpResponse.json({ ...body, bookingWindow })
      }),
    )
    return sent
  }

  it('исключений нет: пустое состояние, кнопка добавления на месте', async () => {
    serveEditor()
    await openEditor()

    expect(
      within(column()).getByRole('heading', { name: 'Исключений нет' }),
    ).toBeInTheDocument()
    expect(
      within(column()).getByText(
        'Добавьте дату, на которую часы отличаются от расписания.',
      ),
    ).toBeInTheDocument()
    expect(
      within(column()).getByRole('button', { name: 'Добавить' }),
    ).toBeInTheDocument()
  })

  it('карточки предстоящих исключений по дате; прошедшие свёрнуты и только для чтения', async () => {
    serveEditor({
      schedule: {
        ...defaultSchedule,
        overrides: [
          { date: '2026-10-28', ranges: [] },
          { date: '2026-11-02', ranges: [{ start: '12:00', end: '13:00' }] },
          {
            date: '2026-11-07',
            ranges: [
              { start: '10:00', end: '12:00' },
              { start: '14:00', end: '15:00' },
            ],
          },
          // Окно записи кончается 15 ноября по Москве
          { date: '2026-11-15', ranges: [] },
          { date: '2026-11-16', ranges: [] },
        ],
      },
    })
    await openEditor()

    const cards = within(column()).getAllByRole('article')
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'пн, 2 ноября',
      'сб, 7 ноября',
      'вс, 15 ноября',
      'пн, 16 ноября',
    ])
    expect(within(cards[0]).getByText('12:00–13:00')).toBeInTheDocument()
    expect(
      within(cards[1]).getByText('10:00–12:00, 14:00–15:00'),
    ).toBeInTheDocument()
    expect(within(cards[2]).getByText('Закрыта')).toBeInTheDocument()
    expect(
      within(cards[3]).getByText('Закрыта · за окном записи'),
    ).toBeInTheDocument()
    expect(
      within(cards[0]).getByRole('button', { name: 'Изменить' }),
    ).toBeInTheDocument()
    expect(
      within(cards[0]).getByRole('button', { name: 'Удалить' }),
    ).toBeInTheDocument()
    expect(
      within(column()).queryByRole('heading', { name: 'Исключений нет' }),
    ).not.toBeInTheDocument()

    expect(
      within(column()).queryByRole('article', { name: 'ср, 28 октября' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(column()).getByRole('button', { name: 'Прошедшие (1)' }),
    )
    const past = await within(column()).findByRole('article', {
      name: 'ср, 28 октября',
    })
    expect(within(past).getByText('Закрыта')).toBeInTheDocument()
    expect(within(past).queryByRole('button')).not.toBeInTheDocument()
  })

  it('«Удалить» убирает исключение из черновика, оно уходит при сохранении', async () => {
    serveEditor({
      schedule: {
        ...defaultSchedule,
        overrides: [
          { date: '2026-11-04', ranges: [] },
          { date: '2026-11-05', ranges: [] },
        ],
      },
    })
    const sent = serveSave()
    await openEditor()

    fireEvent.click(
      within(card('ср, 4 ноября')).getByRole('button', { name: 'Удалить' }),
    )

    expect(
      within(column()).queryByRole('article', { name: 'ср, 4 ноября' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Расписание сохранено')).toBeInTheDocument()
    expect(sent.map((body) => body.overrides)).toEqual([
      [{ date: '2026-11-05', ranges: [] }],
    ])
  })

  it('модалка создания: несколько дат, прошедшие недоступны, даты с исключением подчёркнуты; «Закрыть дату»', async () => {
    serveEditor({
      schedule: {
        ...defaultSchedule,
        overrides: [
          { date: '2026-11-05', ranges: [{ start: '10:00', end: '12:00' }] },
          { date: '2026-11-10', ranges: [] },
        ],
      },
    })
    const sent = serveSave()
    await openEditor()

    fireEvent.click(within(column()).getByRole('button', { name: 'Добавить' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Новое исключение' }),
    )
    expect(dialog.getByRole('button', { name: '1 ноября 2026' })).toBeDisabled()
    expect(dialog.getByRole('button', { name: '5 ноября 2026' })).toHaveStyle({
      textDecoration: 'underline',
    })
    expect(
      dialog.getByRole('button', { name: '4 ноября 2026' }),
    ).not.toHaveStyle({ textDecoration: 'underline' })
    expect(dialog.getByRole('button', { name: 'Готово' })).toBeDisabled()
    expect(dialog.getByRole('radio', { name: 'Закрыть дату' })).toBeChecked()

    fireEvent.click(dialog.getByRole('button', { name: '2 ноября 2026' }))
    fireEvent.click(dialog.getByRole('button', { name: '5 ноября 2026' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Готово' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(
      within(column())
        .getAllByRole('article')
        .map((article) => article.getAttribute('aria-label')),
    ).toEqual(['пн, 2 ноября', 'чт, 5 ноября', 'вт, 10 ноября'])
    expect(
      within(card('чт, 5 ноября')).getByText('Закрыта'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Расписание сохранено')).toBeInTheDocument()
    expect(sent.map((body) => body.overrides)).toEqual([
      [
        { date: '2026-11-02', ranges: [] },
        { date: '2026-11-05', ranges: [] },
        { date: '2026-11-10', ranges: [] },
      ],
    ])
  })

  async function choose(
    dialog: ReturnType<typeof within>,
    select: HTMLElement,
    option: string,
  ) {
    fireEvent.click(select)
    fireEvent.click(await dialog.findByRole('option', { name: option }))
  }

  it('«Свои часы»: промежутки парами Select с шагом 30 минут', async () => {
    serveEditor()
    await openEditor()
    fireEvent.click(within(column()).getByRole('button', { name: 'Добавить' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Новое исключение' }),
    )
    fireEvent.click(dialog.getByRole('button', { name: '7 ноября 2026' }))

    fireEvent.click(dialog.getByRole('radio', { name: 'Свои часы' }))
    const [start] = dialog.getAllByRole('combobox', { name: 'Начало' })
    const [end] = dialog.getAllByRole('combobox', { name: 'Конец' })
    expect(start).toHaveValue('09:00')
    expect(end).toHaveValue('18:00')
    fireEvent.click(start)
    const starts = dialog.getAllByRole('option').map((o) => o.textContent)
    expect(starts.slice(0, 3)).toEqual(['00:00', '00:30', '01:00'])
    expect(starts.at(-1)).toBe('23:30')
    fireEvent.click(dialog.getByRole('option', { name: '10:00' }))
    await choose(dialog, end, '12:30')
    fireEvent.click(dialog.getByRole('button', { name: 'Добавить промежуток' }))
    const ends = dialog.getAllByRole('combobox', { name: 'Конец' })
    await choose(dialog, ends[1], '24:00')
    fireEvent.click(dialog.getByRole('button', { name: 'Готово' }))

    expect(
      await within(column()).findByText('10:00–12:30, 13:30–24:00'),
    ).toBeInTheDocument()
  })

  it('правка: дата фиксирована, часы меняются', async () => {
    serveEditor({
      schedule: {
        ...defaultSchedule,
        overrides: [
          { date: '2026-11-07', ranges: [{ start: '10:00', end: '12:00' }] },
        ],
      },
    })
    await openEditor()

    fireEvent.click(
      within(card('сб, 7 ноября')).getByRole('button', { name: 'Изменить' }),
    )
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Исключение: сб, 7 ноября' }),
    )
    expect(
      dialog.queryByRole('button', { name: '7 ноября 2026' }),
    ).not.toBeInTheDocument()
    expect(dialog.getByRole('radio', { name: 'Свои часы' })).toBeChecked()
    expect(dialog.getByRole('combobox', { name: 'Начало' })).toHaveValue(
      '10:00',
    )
    fireEvent.click(dialog.getByRole('radio', { name: 'Закрыть дату' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Готово' }))

    expect(
      await within(card('сб, 7 ноября')).findByText('Закрыта'),
    ).toBeInTheDocument()
    expect(within(column()).getAllByRole('article')).toHaveLength(1)
  })

  it('исключение, которое закрывает время бронирования: Alert, бронирование в карточке, сохранить нельзя', async () => {
    const line = 'вт, 3 ноября, 10:00–10:30 — Иван Петров (Консультация)'
    serveEditor({
      bookings: [
        booking(),
        // Тот же день, 15:00 по Москве: в часах исключения
        booking({
          start: '2026-11-03T12:00:00Z',
          end: '2026-11-03T12:30:00Z',
          name: 'Мария Котова',
        }),
      ],
    })
    await openEditor()
    fireEvent.click(within(column()).getByRole('button', { name: 'Добавить' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Новое исключение' }),
    )
    fireEvent.click(dialog.getByRole('button', { name: '3 ноября 2026' }))
    fireEvent.click(dialog.getByRole('radio', { name: 'Свои часы' }))
    await choose(
      dialog,
      dialog.getByRole('combobox', { name: 'Начало' }),
      '14:00',
    )
    fireEvent.click(dialog.getByRole('button', { name: 'Готово' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(line)).toBeInTheDocument()
    expect(within(alert).queryByText(/Мария Котова/)).not.toBeInTheDocument()
    expect(within(card('вт, 3 ноября')).getByText(line)).toBeInTheDocument()
    expect(
      within(card('вт, 3 ноября')).queryByText(/Мария Котова/),
    ).not.toBeInTheDocument()

    // Хендлера сохранения нет: запрос уронил бы тест
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(
      await screen.findByRole('dialog', { name: 'Сохранить нельзя' }),
    ).toBeInTheDocument()
  })
})
