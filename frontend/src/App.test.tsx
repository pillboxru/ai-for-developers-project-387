import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { handleListEventTypes } from './api/generated/msw.gen.ts'
import { renderApp } from './test/renderApp.tsx'
import { server } from './test/server.ts'

describe('App', () => {
  it('главная рассказывает о сервисе и ведёт на страницу записи', () => {
    renderApp('/')

    const main = within(screen.getByRole('main'))
    expect(
      main.getByRole('heading', { level: 1, name: 'Календарь звонков' }),
    ).toBeInTheDocument()
    expect(main.getByRole('link', { name: /Записаться/ })).toHaveAttribute(
      'href',
      '/book',
    )
  })

  it('по кнопке «Записаться» открывается страница записи', async () => {
    server.use(handleListEventTypes({ body: [] }))
    renderApp('/')

    const main = within(screen.getByRole('main'))
    fireEvent.click(main.getByRole('link', { name: /Записаться/ }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Запись на звонок',
      }),
    ).toBeInTheDocument()
  })

  it('шаги на главной объясняют, что выбрать и что будет после записи', () => {
    renderApp('/')

    const steps = within(
      screen.getByRole('region', { name: 'Как это работает' }),
    )
    expect(steps.getByText('Выберите тип события')).toBeInTheDocument()
    expect(
      steps.getByText('У каждого типа своё название и длительность.'),
    ).toBeInTheDocument()
    expect(steps.getByText('Оставьте имя и email')).toBeInTheDocument()
    expect(
      steps.getByText('Владелец пришлёт ссылку на звонок на ваш email.'),
    ).toBeInTheDocument()
  })
})

describe('шапка гостя', () => {
  it('ведёт на главную, к записи, владельцу и переключает тему', () => {
    renderApp('/')

    const header = within(screen.getByRole('banner'))
    expect(
      header.getByRole('link', { name: 'Календарь звонков' }),
    ).toHaveAttribute('href', '/')
    expect(header.getByRole('link', { name: 'Записаться' })).toHaveAttribute(
      'href',
      '/book',
    )
    expect(header.getByRole('link', { name: 'Владельцу' })).toHaveAttribute(
      'href',
      '/admin',
    )
    expect(
      header.getByRole('button', { name: /Включить (тёмную|светлую) тему/ }),
    ).toBeInTheDocument()
  })
})

describe('неизвестный адрес', () => {
  it.each(['/unknown', '/book/abc/extra', '/admin/unknown'])(
    '%s показывает «Страница не найдена» со ссылкой на главную',
    (path) => {
      renderApp(path)

      const main = within(screen.getByRole('main'))
      expect(
        main.getByRole('heading', { name: 'Страница не найдена' }),
      ).toBeInTheDocument()
      expect(main.getByRole('link', { name: 'На главную' })).toHaveAttribute(
        'href',
        '/',
      )
      expect(screen.getByRole('banner')).toBeInTheDocument()
    },
  )
})
