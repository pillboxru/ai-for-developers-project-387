import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  handleGetEventType,
  handleGetOwner,
  handleListEventTypes,
  handleListSlots,
} from '../api/generated/msw.gen.ts'
import type { PublicEventType } from '../api/generated/types.gen.ts'
import { renderApp } from '../test/renderApp.tsx'
import { server } from '../test/server.ts'

function publicEventType(
  overrides: Partial<PublicEventType> = {},
): PublicEventType {
  return {
    id: crypto.randomUUID(),
    title: 'Консультация',
    durationMinutes: 30,
    ...overrides,
  }
}

// Карточка типа — ссылка, её имя начинается с названия
const eventTypeCard = (title: string) =>
  screen.findByRole('link', { name: new RegExp(`^${title}`) })

describe('список типов событий гостя', () => {
  it('показывает типы в порядке ответа с названием и длительностью', async () => {
    server.use(
      handleListEventTypes({
        body: [
          publicEventType({ title: 'Знакомство', durationMinutes: 15 }),
          publicEventType({ title: 'Разбор', durationMinutes: 60 }),
          publicEventType({ title: 'Сессия', durationMinutes: 90 }),
        ],
      }),
    )
    renderApp('/book')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Запись на звонок' }),
    ).toBeInTheDocument()
    await eventTypeCard('Знакомство')
    const main = within(screen.getByRole('main'))
    expect(
      main.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Знакомство', 'Разбор', 'Сессия'])
    expect(await eventTypeCard('Знакомство')).toHaveTextContent('15 мин')
    expect(await eventTypeCard('Разбор')).toHaveTextContent('1 ч')
    expect(await eventTypeCard('Сессия')).toHaveTextContent('1 ч 30 мин')
  })

  it('описание показывает переносы строк и не применяет Markdown', async () => {
    const description = 'Обсудим **задачу**\n- сроки\n- бюджет'
    server.use(
      handleListEventTypes({
        body: [
          publicEventType({ title: 'Консультация', description }),
          publicEventType({ title: 'Знакомство' }),
        ],
      }),
    )
    renderApp('/book')

    const card = await eventTypeCard('Консультация')
    const text = within(card).getByText(description, {
      normalizer: (value) => value,
    })
    expect(text).toHaveStyle({ whiteSpace: 'pre-line' })
    expect(within(card).queryByRole('strong')).toBeNull()
    expect(within(card).queryByRole('list')).toBeNull()

    const withoutDescription = await eventTypeCard('Знакомство')
    expect(withoutDescription).toHaveTextContent(/^Знакомство30 мин$/)
  })

  it('выбор типа открывает его страницу', async () => {
    const eventType = publicEventType({ title: 'Разбор кода' })
    server.use(
      handleListEventTypes({ body: [eventType] }),
      handleGetEventType({ body: eventType }),
      handleGetOwner({ body: { name: 'Анна', timeZone: 'Europe/Moscow' } }),
      handleListSlots({
        body: {
          bookingWindow: {
            start: '2026-10-24T21:00:00Z',
            end: '2026-11-07T21:00:00Z',
          },
          slots: [],
        },
      }),
    )
    renderApp('/book')

    const card = await eventTypeCard('Разбор кода')
    expect(card).toHaveAttribute('href', `/book/${eventType.id}`)
    fireEvent.click(card)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Разбор кода' }),
    ).toBeInTheDocument()
  })

  it('без видимых типов показывает пустое состояние', async () => {
    server.use(handleListEventTypes({ body: [] }))
    renderApp('/book')

    expect(
      await screen.findByRole('heading', { name: 'Пока не на что записаться' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Владелец ещё не открыл запись. Загляните позже.'),
    ).toBeInTheDocument()
  })
})
