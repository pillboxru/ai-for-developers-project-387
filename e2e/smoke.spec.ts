import { expect, test } from '@playwright/test'

test('с главной по кнопке «Записаться» открывается страница записи', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('main').getByRole('link', { name: 'Записаться' }).click()

  await expect(page).toHaveURL('/book')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Запись на звонок' }),
  ).toBeVisible()
})
