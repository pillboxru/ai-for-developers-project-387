import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  handleGetOwner,
  handleGetSchedule,
  handleListBookings,
} from '../api/generated/msw.gen.ts'
import { renderApp } from '../test/renderApp.tsx'
import { server } from '../test/server.ts'

// Разделы «Бронирования» и «Расписание» сразу загружают свои данные;
// шапке они не важны, поэтому пустые
beforeEach(() => {
  server.use(
    handleGetOwner({
      body: { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' },
    }),
    handleListBookings({ body: [] }),
    handleGetSchedule({
      body: {
        weekly: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
        overrides: [],
        bookingWindow: {
          start: '2026-11-01T21:00:00Z',
          end: '2026-11-15T21:00:00Z',
        },
      },
    }),
  )
})

describe('шапка владельца', () => {
  it('/admin перенаправляет на бронирования', async () => {
    renderApp('/admin')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Бронирования' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Бронирования' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('ведёт на главную, к записи и переключает разделы вкладками', async () => {
    renderApp('/admin/bookings')

    const header = within(screen.getByRole('banner'))
    expect(
      header.getByRole('link', { name: 'Календарь звонков' }),
    ).toHaveAttribute('href', '/')
    expect(header.getByRole('link', { name: 'К записи' })).toHaveAttribute(
      'href',
      '/book',
    )
    expect(
      header.getByRole('button', { name: /Включить (тёмную|светлую) тему/ }),
    ).toBeInTheDocument()

    fireEvent.click(header.getByRole('tab', { name: 'Расписание' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Расписание' }),
    ).toBeInTheDocument()
    expect(header.getByRole('tab', { name: 'Расписание' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('на узком экране разделы открываются из бургер-меню', async () => {
    renderApp('/admin/bookings')

    fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }))
    const drawer = within(await screen.findByRole('dialog'))
    expect(drawer.getByRole('link', { name: 'Бронирования' })).toHaveAttribute(
      'href',
      '/admin/bookings',
    )
    expect(drawer.getByRole('link', { name: 'К записи' })).toHaveAttribute(
      'href',
      '/book',
    )
    fireEvent.click(drawer.getByRole('link', { name: 'Расписание' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Расписание' }),
    ).toBeInTheDocument()
  })
})
