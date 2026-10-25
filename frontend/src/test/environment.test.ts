import { describe, expect, it } from 'vitest'

describe('окружение тестов', () => {
  // Пояс процесса нарочно отличается от пояса владельца (Europe/Moscow):
  // так тесты ловят код, который путает время гостя и владельца
  it('процесс Vitest живёт по Владивостоку', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      'Asia/Vladivostok',
    )
    expect(new Date('2026-11-02T00:00:00Z').getHours()).toBe(10)
  })
})
