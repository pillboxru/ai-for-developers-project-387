import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleCreateBooking,
  handleGetEventType,
  handleGetOwner,
  handleListSlots,
} from '../api/generated/msw.gen.ts'
import type {
  ApiError,
  Booking,
  CreateBooking,
  Owner,
  PublicEventType,
  Slot,
} from '../api/generated/types.gen.ts'
import { renderApp } from '../test/renderApp.tsx'
import { server } from '../test/server.ts'

const eventTypeId = '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11'

const eventType: PublicEventType = {
  id: eventTypeId,
  title: 'Консультация',
  description: 'Разберём код\nи архитектуру',
  durationMinutes: 30,
}

const owner: Owner = { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' }

// Сегодня у владельца 25 октября: окно записи — с 00:00 25.10 до 00:00 08.11
// по Москве. Гость во Владивостоке (+7 ч к Москве) видит его с 07:00 25.10
// до 07:00 08.11, то есть даты 25 октября — 8 ноября
const today = new Date('2026-10-25T03:00:00Z')
const bookingWindow = {
  start: '2026-10-24T21:00:00Z',
  end: '2026-11-07T21:00:00Z',
}

function slot(start: string): Slot {
  const end = new Date(new Date(start).getTime() + 30 * 60_000)
  return { start, end: end.toISOString().replace('.000Z', 'Z') }
}

const slotParam = (search: string) => new URLSearchParams(search).get('slot')

function serveScreen({
  ownerProfile = owner,
  slots = [],
}: { ownerProfile?: Owner; slots?: Slot[] } = {}) {
  server.use(
    handleGetEventType({ body: eventType }),
    handleGetOwner({ body: ownerProfile }),
    handleListSlots({ body: { bookingWindow, slots } }),
  )
}

beforeEach(() => {
  vi.setSystemTime(today)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('страница типа события', () => {
  it('в левой колонке владелец, тип события и пояс', async () => {
    serveScreen({ slots: [slot('2026-10-26T23:00:00Z')] })
    renderApp(`/book/${eventTypeId}`)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Консультация' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Анна Смирнова')).toBeInTheDocument()
    expect(screen.getByText('АС')).toBeInTheDocument()
    expect(screen.getByText('30 мин')).toBeInTheDocument()
    expect(screen.getByText(/^Разберём код/)).toHaveTextContent(
      'Разберём код и архитектуру',
    )
    expect(
      screen.getByText(
        'Время показано по вашему поясу: Asia/Vladivostok. Владелец работает по Europe/Moscow.',
      ),
    ).toBeInTheDocument()
  })

  it('пояса гостя и владельца совпадают — одна подпись пояса', async () => {
    serveScreen({
      ownerProfile: { ...owner, timeZone: 'Asia/Vladivostok' },
      slots: [slot('2026-10-26T23:00:00Z')],
    })
    renderApp(`/book/${eventTypeId}`)

    expect(
      await screen.findByText('Время указано по поясу Asia/Vladivostok'),
    ).toBeInTheDocument()
  })

  it('календарь в границах окна по поясу гостя, даты без слотов неактивны', async () => {
    serveScreen({
      slots: [
        // 27 октября 09:00 у гостя, а в UTC ещё 26-е
        slot('2026-10-26T23:00:00Z'),
        slot('2026-11-03T00:00:00Z'),
      ],
    })
    renderApp(`/book/${eventTypeId}`)

    const day = (name: string) => screen.getByRole('button', { name })
    expect(
      await screen.findByRole('button', { name: '27 октября 2026' }),
    ).toBePressed()
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(/^пн$/i)
    expect(day('24 октября 2026')).toBeDisabled()
    expect(day('25 октября 2026')).toBeDisabled()
    expect(day('28 октября 2026')).toBeDisabled()
    expect(day('27 октября 2026')).toBeEnabled()
    expect(day('Предыдущий месяц')).toBeDisabled()

    fireEvent.click(day('Следующий месяц'))

    expect(day('3 ноября 2026')).toBeEnabled()
    expect(day('8 ноября 2026')).toBeDisabled()
    expect(day('9 ноября 2026')).toBeDisabled()
    expect(day('Следующий месяц')).toBeDisabled()
  })

  it('слоты дня по частям дня гостя, пустые группы скрыты', async () => {
    serveScreen({
      slots: [
        // Время у гостя: 09:00, 11:30, 12:00, 16:30, 17:00 27 октября
        slot('2026-10-26T23:00:00Z'),
        slot('2026-10-27T01:30:00Z'),
        slot('2026-10-27T02:00:00Z'),
        slot('2026-10-27T06:30:00Z'),
        slot('2026-10-27T07:00:00Z'),
        // 3 ноября 10:00 у гостя
        slot('2026-11-03T00:00:00Z'),
      ],
    })
    renderApp(`/book/${eventTypeId}`)

    const times = (part: string) =>
      within(screen.getByRole('group', { name: part }))
        .getAllByRole('button')
        .map((button) => button.textContent)
    expect(
      await screen.findByRole('heading', { name: 'вт, 27 октября' }),
    ).toBeInTheDocument()
    expect(times('Утро')).toEqual(['09:00', '11:30'])
    expect(times('День')).toEqual(['12:00', '16:30'])
    expect(times('Вечер')).toEqual(['17:00'])

    fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }))
    fireEvent.click(screen.getByRole('button', { name: '3 ноября 2026' }))

    expect(
      screen.getByRole('heading', { name: 'вт, 3 ноября' }),
    ).toBeInTheDocument()
    expect(times('Утро')).toEqual(['10:00'])
    expect(screen.queryByRole('group', { name: 'День' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Вечер' })).toBeNull()
  })

  describe('выбранный слот в адресе', () => {
    const slots = [
      slot('2026-10-26T23:00:00Z'),
      slot('2026-10-27T01:30:00Z'),
      slot('2026-11-03T00:00:00Z'),
    ]

    it('нажатие на слот пишет его начало в ?slot= и открывает форму', async () => {
      serveScreen({ slots })
      const { currentLocation } = renderApp(`/book/${eventTypeId}`)

      fireEvent.click(await screen.findByRole('button', { name: '11:30' }))

      expect(slotParam(currentLocation().search)).toBe('2026-10-27T01:30:00Z')
      expect(screen.getByRole('textbox', { name: /^Имя/ })).toBeInTheDocument()
      expect(
        screen.getByRole('textbox', { name: /^Email/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('textbox', { name: 'Комментарий' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Забронировать' }),
      ).toBeInTheDocument()
      // Календарь и слоты сменились формой в той же карточке
      expect(
        screen.queryByRole('button', { name: '27 октября 2026' }),
      ).toBeNull()
      expect(screen.queryByRole('button', { name: '09:00' })).toBeNull()
      // В левой колонке выбранное время по часам гостя
      expect(
        screen.getByText('вт, 27 октября, 11:30–12:00'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument()
    })

    it('перезагрузка с действующим ?slot= снова открывает форму', async () => {
      serveScreen({ slots })
      renderApp(`/book/${eventTypeId}?slot=2026-11-03T00:00:00Z`)

      expect(
        await screen.findByRole('button', { name: 'Забронировать' }),
      ).toBeInTheDocument()
      expect(screen.getByText('вт, 3 ноября, 10:00–10:30')).toBeInTheDocument()
    })

    it('«Назад» убирает ?slot= и возвращает к выбору слота на дате слота', async () => {
      serveScreen({ slots })
      const { currentLocation } = renderApp(
        `/book/${eventTypeId}?slot=2026-11-03T00:00:00Z`,
      )

      fireEvent.click(await screen.findByRole('button', { name: 'Назад' }))

      await waitFor(() =>
        expect(slotParam(currentLocation().search)).toBeNull(),
      )
      expect(
        screen.getByRole('button', { name: '3 ноября 2026' }),
      ).toBePressed()
      expect(
        screen.getByRole('heading', { name: 'вт, 3 ноября' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Забронировать' })).toBeNull()
    })

    it('кнопка «назад» браузера убирает ?slot= и возвращает к той же дате', async () => {
      serveScreen({ slots })
      const { currentLocation, goBack } = renderApp(`/book/${eventTypeId}`)
      fireEvent.click(
        await screen.findByRole('button', { name: 'Следующий месяц' }),
      )
      fireEvent.click(screen.getByRole('button', { name: '3 ноября 2026' }))
      fireEvent.click(screen.getByRole('button', { name: '10:00' }))
      expect(
        screen.getByRole('button', { name: 'Забронировать' }),
      ).toBeInTheDocument()

      act(() => goBack())

      await waitFor(() =>
        expect(slotParam(currentLocation().search)).toBeNull(),
      )
      expect(
        screen.getByRole('button', { name: '3 ноября 2026' }),
      ).toBePressed()
    })

    it('?slot= не из списка слотов сбрасывается с предупреждением', async () => {
      serveScreen({ slots })
      const { currentLocation } = renderApp(
        `/book/${eventTypeId}?slot=2026-11-03T00:15:00Z`,
      )

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Это время уже недоступно. Выберите другое.',
      )
      await waitFor(() =>
        expect(slotParam(currentLocation().search)).toBeNull(),
      )
      expect(
        screen.getByRole('heading', { name: 'вт, 27 октября' }),
      ).toBeInTheDocument()

      fireEvent.click(within(alert).getByRole('button', { name: 'Закрыть' }))
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('форма бронирования', () => {
    // Вторник 27 октября, 11:30–12:00 у гостя во Владивостоке
    const chosen = slot('2026-10-27T01:30:00Z')
    const otherSlot = slot('2026-10-27T02:00:00Z')

    async function openForm() {
      serveScreen({ slots: [chosen, otherSlot] })
      const app = renderApp(`/book/${eventTypeId}?slot=${chosen.start}`)
      await screen.findByRole('button', { name: 'Забронировать' })
      return app
    }

    const field = (name: RegExp | string) =>
      screen.getByRole('textbox', { name })
    const nameField = () => field(/^Имя/)
    const emailField = () => field(/^Email/)
    const commentField = () => field('Комментарий')
    const type = (input: HTMLElement, value: string) =>
      fireEvent.change(input, { target: { value } })
    const submit = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }))

    it('пустые обязательные поля: ошибки у полей при отправке, запрос не уходит', async () => {
      await openForm()

      // До отправки уход с поля ошибку не показывает
      fireEvent.blur(nameField())
      expect(nameField()).not.toHaveAccessibleDescription('Обязательное поле')

      // Без обработчика createBooking запрос валит тест
      type(nameField(), '   ')
      submit()

      expect(nameField()).toHaveAccessibleDescription('Обязательное поле')
      expect(emailField()).toHaveAccessibleDescription('Обязательное поле')
      expect(commentField()).not.toHaveAccessibleDescription()
    })

    it('длина и формат проверяются после обрезки пробелов', async () => {
      await openForm()

      type(nameField(), 'я'.repeat(101))
      type(emailField(), 'ivan@example')
      type(commentField(), `  ${'я'.repeat(1001)}  `)
      submit()

      expect(nameField()).toHaveAccessibleDescription('Не больше 100 символов')
      expect(emailField()).toHaveAccessibleDescription('Неверный формат')
      expect(commentField()).toHaveAccessibleDescription(
        'Не больше 1000 символов',
      )

      type(emailField(), `${'a'.repeat(250)}@x.ru`)
      submit()
      expect(emailField()).toHaveAccessibleDescription('Не больше 254 символов')
    })

    it('после первой отправки ошибка видна и при уходе с поля', async () => {
      await openForm()
      type(nameField(), 'Иван')
      submit()
      expect(nameField()).not.toHaveAccessibleDescription('Обязательное поле')

      type(nameField(), ' ')
      fireEvent.blur(nameField())

      await waitFor(() =>
        expect(nameField()).toHaveAccessibleDescription('Обязательное поле'),
      )
    })

    const booking = (body: CreateBooking): Booking => ({
      id: 'b9d1f0a2-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
      eventType: { id: eventTypeId, title: 'Консультация', hidden: false },
      start: chosen.start,
      end: chosen.end,
      name: body.name,
      email: body.email,
      ...(body.comment && { comment: body.comment }),
      cancelled: false,
    })

    it('отправляет обрезанные данные без пустого комментария и показывает подтверждение', async () => {
      const requests: CreateBooking[] = []
      server.use(
        handleCreateBooking(async ({ request }) => {
          const body = await request.json()
          requests.push(body)
          return HttpResponse.json(booking(body), { status: 201 })
        }),
      )
      const { currentLocation } = await openForm()

      type(nameField(), '  Иван Петров ')
      type(emailField(), ' Ivan@Example.com ')
      type(commentField(), '   ')
      submit()

      expect(
        await screen.findByRole('heading', { name: 'Вы записаны' }),
      ).toBeInTheDocument()
      expect(requests).toEqual([
        {
          start: chosen.start,
          name: 'Иван Петров',
          email: 'Ivan@Example.com',
        },
      ])
      const confirmation = within(screen.getByRole('main'))
      expect(
        confirmation.getAllByText('вт, 27 октября, 11:30–12:00'),
      ).not.toHaveLength(0)
      expect(
        confirmation.getByText(
          'Владелец пришлёт ссылку на звонок на Ivan@Example.com',
        ),
      ).toBeInTheDocument()
      expect(
        confirmation.getByText(
          'Это подтверждение не сохранится после закрытия страницы',
        ),
      ).toBeInTheDocument()
      expect(confirmation.queryByText('Комментарий')).toBeNull()
      // У подтверждения нет своего адреса: перезагрузка вернёт выбор слота
      await waitFor(() =>
        expect(slotParam(currentLocation().search)).toBeNull(),
      )
      expect(currentLocation().pathname).toBe(`/book/${eventTypeId}`)
    })

    it('подтверждение: тип, время с поясом, владелец, данные гостя, кнопки', async () => {
      server.use(
        handleCreateBooking(async ({ request }) =>
          HttpResponse.json(booking(await request.json()), { status: 201 }),
        ),
      )
      await openForm()

      type(nameField(), 'Иван Петров')
      type(emailField(), 'ivan@example.com')
      type(commentField(), 'Обсудим\nархитектуру')
      submit()

      const confirmation = within(
        await screen.findByRole('region', { name: 'Вы записаны' }),
      )
      expect(confirmation.getByText('Консультация')).toBeInTheDocument()
      expect(
        confirmation.getByText('вт, 27 октября, 11:30–12:00'),
      ).toBeInTheDocument()
      expect(
        confirmation.getByText(
          'Время показано по вашему поясу: Asia/Vladivostok. Владелец работает по Europe/Moscow.',
        ),
      ).toBeInTheDocument()
      expect(confirmation.getByText('Анна Смирнова')).toBeInTheDocument()
      expect(confirmation.getByText('Иван Петров')).toBeInTheDocument()
      expect(confirmation.getByText('ivan@example.com')).toBeInTheDocument()
      expect(confirmation.getByText(/^Обсудим/)).toHaveTextContent(
        'Обсудим архитектуру',
      )
      expect(
        confirmation.getByRole('link', { name: 'Записаться ещё' }),
      ).toHaveAttribute('href', '/book')
      expect(
        confirmation.getByRole('link', { name: 'На главную' }),
      ).toHaveAttribute('href', '/')
      // Слева больше нет «Назад»: возвращаться не к чему
      expect(screen.queryByRole('button', { name: 'Назад' })).toBeNull()
    })

    const fillForm = () => {
      type(nameField(), 'Иван Петров')
      type(emailField(), 'ivan@example.com')
      type(commentField(), 'Обсудим архитектуру')
    }

    it('пока запрос идёт, «Забронировать» в loading и неактивна', async () => {
      let respond: (response: Response) => void = () => {}
      server.use(
        handleCreateBooking(
          () => new Promise<Response>((resolve) => (respond = resolve)),
        ),
      )
      await openForm()
      fillForm()

      submit()

      const button = await screen.findByRole('button', {
        name: 'Забронировать',
      })
      await waitFor(() => expect(button).toBeDisabled())
      expect(button).toHaveAttribute('data-loading')
      respond(
        HttpResponse.json(
          booking({
            start: chosen.start,
            name: 'Иван Петров',
            email: 'ivan@example.com',
          }),
          { status: 201 },
        ),
      )
      expect(
        await screen.findByRole('heading', { name: 'Вы записаны' }),
      ).toBeInTheDocument()
    })

    it('ошибки 400 из ответа показываются у тех же полей', async () => {
      server.use(
        handleCreateBooking(() =>
          HttpResponse.json<ApiError>(
            {
              code: 'validation_error',
              message: 'Проверьте введённые данные',
              fieldErrors: [
                { field: 'name', message: 'Неверный формат' },
                { field: 'email', message: 'Не больше 254 символов' },
              ],
            },
            { status: 400 },
          ),
        ),
      )
      await openForm()
      fillForm()

      submit()

      await waitFor(() =>
        expect(nameField()).toHaveAccessibleDescription('Неверный формат'),
      )
      expect(emailField()).toHaveAccessibleDescription('Не больше 254 символов')
    })

    describe('409 slot_unavailable', () => {
      // 3 ноября 10:00 у гостя
      const laterSlot = slot('2026-11-03T00:00:00Z')

      // Слоты до отказа и после него: сервер к моменту отказа уже отдаёт
      // список без занятого слота
      function serveRejection(slotsAfter: Slot[]) {
        let served = [chosen, otherSlot, laterSlot]
        server.use(
          handleGetEventType({ body: eventType }),
          handleGetOwner({ body: owner }),
          handleListSlots(() =>
            HttpResponse.json({ bookingWindow, slots: served }),
          ),
          handleCreateBooking(() => {
            served = slotsAfter
            return HttpResponse.json<ApiError>(
              {
                code: 'slot_unavailable',
                message: 'Это время уже недоступно. Выберите другое.',
              },
              { status: 409 },
            )
          }),
        )
      }

      it('возврат к выбору слота на той же дате с Alert и перезагруженными слотами, данные формы подставлены', async () => {
        serveRejection([otherSlot, laterSlot])
        const { currentLocation } = renderApp(
          `/book/${eventTypeId}?slot=${chosen.start}`,
        )
        await screen.findByRole('button', { name: 'Забронировать' })
        fillForm()

        submit()

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Это время уже недоступно. Выберите другое.',
        )
        await waitFor(() =>
          expect(slotParam(currentLocation().search)).toBeNull(),
        )
        expect(
          screen.getByRole('button', { name: '27 октября 2026' }),
        ).toBePressed()
        await waitFor(() =>
          expect(screen.queryByRole('button', { name: '11:30' })).toBeNull(),
        )

        fireEvent.click(screen.getByRole('button', { name: '12:00' }))

        expect(nameField()).toHaveValue('Иван Петров')
        expect(emailField()).toHaveValue('ivan@example.com')
        expect(commentField()).toHaveValue('Обсудим архитектуру')
      })

      it('на дате отказавшего слота слотов не осталось — первая дата со слотами', async () => {
        serveRejection([laterSlot])
        renderApp(`/book/${eventTypeId}?slot=${chosen.start}`)
        await screen.findByRole('button', { name: 'Забронировать' })
        fillForm()

        submit()

        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(
          await screen.findByRole('heading', { name: 'вт, 3 ноября' }),
        ).toBeInTheDocument()
      })
    })

    it('тип скрыли или удалили, пока гость заполнял форму: «Тип события не найден»', async () => {
      server.use(
        handleCreateBooking(() =>
          HttpResponse.json<ApiError>(
            { code: 'not_found', message: 'Не найдено' },
            { status: 404 },
          ),
        ),
      )
      await openForm()
      fillForm()

      submit()

      const main = within(screen.getByRole('main'))
      expect(
        await main.findByRole('heading', { name: 'Тип события не найден' }),
      ).toBeInTheDocument()
      expect(
        main.getByRole('link', { name: 'К списку типов событий' }),
      ).toHaveAttribute('href', '/book')
    })

    it('сбой сервера: уведомление, форма с данными остаётся', async () => {
      server.use(
        handleCreateBooking(() =>
          HttpResponse.json<ApiError>(
            { code: 'internal_error', message: 'Внутренняя ошибка сервера' },
            { status: 500 },
          ),
        ),
      )
      await openForm()
      fillForm()

      submit()

      expect(
        await screen.findByText('Не удалось сохранить. Попробуйте ещё раз.'),
      ).toBeInTheDocument()
      expect(nameField()).toHaveValue('Иван Петров')
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Забронировать' }),
        ).toBeEnabled(),
      )
    })
  })

  it('без слотов в окне — пустое состояние, левая колонка остаётся', async () => {
    serveScreen({ slots: [] })
    renderApp(`/book/${eventTypeId}`)

    expect(
      await screen.findByRole('heading', {
        name: 'В ближайшие 14 дней свободного времени нет',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Выбрать другой тип события' }),
    ).toHaveAttribute('href', '/book')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Консультация' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Следующий месяц' })).toBeNull()
  })

  it.each<[string, string, number, ApiError]>([
    [
      'скрытый или несуществующий тип (404)',
      eventTypeId,
      404,
      { code: 'not_found', message: 'Не найдено' },
    ],
    [
      'id не UUID (400)',
      'not-a-uuid',
      400,
      { code: 'validation_error', message: 'Неверный адрес запроса' },
    ],
  ])(
    '%s: «Тип события не найден» со ссылкой на список',
    async (_case, id, status, error) => {
      server.use(
        handleGetEventType(() => HttpResponse.json(error, { status })),
        handleListSlots(() => HttpResponse.json(error, { status })),
        handleGetOwner({ body: owner }),
      )
      renderApp(`/book/${id}`)

      const main = within(screen.getByRole('main'))
      expect(
        await main.findByRole('heading', { name: 'Тип события не найден' }),
      ).toBeInTheDocument()
      expect(main.queryByRole('alert')).toBeNull()
      expect(
        main.getByRole('link', { name: 'К списку типов событий' }),
      ).toHaveAttribute('href', '/book')
    },
  )

  it('сбой сервера — ошибка загрузки с «Повторить», а не «не найден»', async () => {
    server.use(
      handleGetEventType(() =>
        HttpResponse.json<ApiError>(
          { code: 'internal_error', message: 'Внутренняя ошибка сервера' },
          { status: 500 },
        ),
      ),
      handleGetOwner({ body: owner }),
      handleListSlots({ body: { bookingWindow, slots: [] } }),
    )
    renderApp(`/book/${eventTypeId}`)

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByRole('button', { name: 'Повторить' }),
    ).toBeVisible()
    expect(screen.queryByText('Тип события не найден')).toBeNull()
  })
})
