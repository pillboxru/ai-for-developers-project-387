import { Temporal } from 'temporal-polyfill'
import { describe, expect, it } from 'vitest'
import type { Slot, WeeklySchedule } from '../generated/types.gen.js'
import { createBookingRepository } from '../repositories/bookings.js'
import { createEventTypeRepository } from '../repositories/eventTypes.js'
import { createScheduleRepository } from '../repositories/schedule.js'
import { computeSlots, createSlotService, type SlotInput } from './slots.js'

const weekdays9to18 = [{ start: '09:00', end: '18:00' }]

// Москва без перехода на летнее время, UTC+3. Понедельник 2 ноября 2026,
// 09:00 по Москве
const input = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  eventType: { durationMinutes: 30, slotStepMinutes: 30 },
  availability: {
    weekly: {
      monday: weekdays9to18,
      tuesday: weekdays9to18,
      wednesday: weekdays9to18,
      thursday: weekdays9to18,
      friday: weekdays9to18,
      saturday: [],
      sunday: [],
    },
    overrides: [],
  },
  bookings: [],
  now: new Date('2026-11-02T06:00:00Z'),
  timeZone: 'Europe/Moscow',
  ...overrides,
})

const closedWeek: WeeklySchedule = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
}

// Начала слотов даты по часам владельца: так проверки читаются как условия
// спецификации («9:30, 10:15, 11:00»)
function startsOn(slots: Slot[], date: string, timeZone = 'Europe/Moscow') {
  return slots
    .map((slot) =>
      Temporal.Instant.from(slot.start).toZonedDateTimeISO(timeZone),
    )
    .filter((start) => start.toPlainDate().toString() === date)
    .map((start) => start.toPlainTime().toString({ smallestUnit: 'minute' }))
}

describe('окно записи', () => {
  it('от 00:00 сегодняшней даты владельца до 00:00 через 14 дней', () => {
    // 23:30 воскресенья по UTC — уже понедельник по Москве
    const { bookingWindow } = computeSlots(
      input({ now: new Date('2026-11-01T23:30:00Z') }),
    )

    expect(bookingWindow).toEqual({
      start: '2026-11-01T21:00:00Z',
      end: '2026-11-15T21:00:00Z',
    })
  })
})

describe('сетка слотов', () => {
  it('шаг отсчитывается от начала куска доступного времени', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 30, slotStepMinutes: 45 },
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '09:30', end: '13:00' }],
          },
          overrides: [],
        },
      }),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual([
      '09:30',
      '10:15',
      '11:00',
      '11:45',
      '12:30',
    ])
  })

  it('слот длится столько, сколько тип события, моменты в UTC', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 60, slotStepMinutes: 60 },
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '09:00', end: '11:00' }],
          },
          overrides: [],
        },
      }),
    )

    expect(slots.slice(0, 2)).toEqual([
      { start: '2026-11-03T06:00:00Z', end: '2026-11-03T07:00:00Z' },
      { start: '2026-11-03T07:00:00Z', end: '2026-11-03T08:00:00Z' },
    ])
  })
})

describe('минимальный запас', () => {
  it('слот начинается не раньше чем через час от текущего момента', () => {
    const { slots } = computeSlots(input())

    expect(startsOn(slots, '2026-11-02').slice(0, 2)).toEqual([
      '10:00',
      '10:30',
    ])
  })

  it('слот внутри часа запаса не предлагается, даже если он на сетке', () => {
    const { slots } = computeSlots(
      input({ now: new Date('2026-11-02T06:10:00Z') }),
    )

    expect(startsOn(slots, '2026-11-02')[0]).toBe('10:30')
  })
})

describe('бронирования', () => {
  // Вторник 3 ноября по Москве
  const tuesday = (time: string) => `2026-11-03T${time}:00+03:00`
  const booking = (start: string, end: string, cancelled = false) => ({
    start: new Date(tuesday(start)).toISOString(),
    end: new Date(tuesday(end)).toISOString(),
    cancelled,
  })
  const tuesdayInput = (
    durationMinutes: 30 | 60,
    bookings: SlotInput['bookings'],
  ) =>
    input({
      eventType: { durationMinutes, slotStepMinutes: 30 },
      availability: {
        weekly: { ...closedWeek, tuesday: [{ start: '09:00', end: '12:00' }] },
        overrides: [],
      },
      bookings,
    })

  it('бронирование на 60 минут в 10:00 убирает 30-минутные слоты 10:00 и 10:30, соседние стоят впритык', () => {
    const { slots } = computeSlots(
      tuesdayInput(30, [booking('10:00', '11:00')]),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual([
      '09:00',
      '09:30',
      '11:00',
      '11:30',
    ])
  })

  it('бронирование на 30 минут в 10:30 убирает 60-минутные слоты 10:00 и 10:30', () => {
    const { slots } = computeSlots(
      tuesdayInput(60, [booking('10:30', '11:00')]),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual(['09:00', '09:30', '11:00'])
  })

  it('бронирование не на сетке не сдвигает её, а только убирает пересечения', () => {
    const { slots } = computeSlots(
      tuesdayInput(30, [booking('10:15', '10:30')]),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual([
      '09:00',
      '09:30',
      '10:30',
      '11:00',
      '11:30',
    ])
  })

  it('отменённое бронирование время не занимает', () => {
    const { slots } = computeSlots(
      tuesdayInput(30, [booking('10:00', '11:00', true)]),
    )

    expect(startsOn(slots, '2026-11-03')).toContain('10:00')
    expect(startsOn(slots, '2026-11-03')).toContain('10:30')
  })
})

describe('доступное время — непрерывная шкала', () => {
  it('кусок через полночь — один кусок: сетка не начинается заново в 00:00, слот через полночь относится к дате начала', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 60, slotStepMinutes: 45 },
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '22:00', end: '24:00' }],
            wednesday: [{ start: '00:00', end: '02:00' }],
          },
          overrides: [],
        },
      }),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual(['22:00', '22:45', '23:30'])
    expect(startsOn(slots, '2026-11-04')).toEqual(['00:15', '01:00'])
  })

  it('кусок, начатый до окна записи, задаёт сетку и в первый день окна', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 30, slotStepMinutes: 45 },
        availability: {
          weekly: {
            ...closedWeek,
            sunday: [{ start: '23:30', end: '24:00' }],
            monday: [{ start: '00:00', end: '03:00' }],
          },
          overrides: [],
        },
        // Понедельник, 00:00 по Москве
        now: new Date('2026-11-01T21:00:00Z'),
      }),
    )

    expect(startsOn(slots, '2026-11-02')).toEqual(['01:00', '01:45', '02:30'])
  })
})

describe('слот целиком в доступном времени и окне записи', () => {
  it('слот, который не помещается до конца куска, не предлагается', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 60, slotStepMinutes: 45 },
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '09:30', end: '13:00' }],
          },
          overrides: [],
        },
      }),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual([
      '09:30',
      '10:15',
      '11:00',
      '11:45',
    ])
  })

  it('слот, который заканчивается после 00:00 пятнадцатого дня, не предлагается', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 60, slotStepMinutes: 30 },
        availability: {
          weekly: {
            ...closedWeek,
            sunday: [{ start: '23:00', end: '24:00' }],
            monday: [{ start: '00:00', end: '02:00' }],
          },
          overrides: [],
        },
      }),
    )

    // 15 ноября — последний день окна, 16-го окно уже закрыто
    expect(startsOn(slots, '2026-11-08')).toEqual(['23:00', '23:30'])
    expect(startsOn(slots, '2026-11-15')).toEqual(['23:00'])
    expect(slots.at(-1)).toEqual({
      start: '2026-11-15T20:00:00Z',
      end: '2026-11-15T21:00:00Z',
    })
  })
})

describe('шаг слотов и длительность', () => {
  it('шаг больше длительности оставляет зазор', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 30, slotStepMinutes: 60 },
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '09:00', end: '12:00' }],
          },
          overrides: [],
        },
      }),
    )

    expect(slots.slice(0, 2)).toEqual([
      { start: '2026-11-03T06:00:00Z', end: '2026-11-03T06:30:00Z' },
      { start: '2026-11-03T07:00:00Z', end: '2026-11-03T07:30:00Z' },
    ])
    expect(startsOn(slots, '2026-11-03')).toEqual(['09:00', '10:00', '11:00'])
  })

  it('шаг меньше длительности даёт пересекающиеся слоты', () => {
    const { slots } = computeSlots(
      input({
        eventType: { durationMinutes: 60, slotStepMinutes: 15 },
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '09:00', end: '10:30' }],
          },
          overrides: [],
        },
      }),
    )

    expect(slots.slice(0, 3)).toEqual([
      { start: '2026-11-03T06:00:00Z', end: '2026-11-03T07:00:00Z' },
      { start: '2026-11-03T06:15:00Z', end: '2026-11-03T07:15:00Z' },
      { start: '2026-11-03T06:30:00Z', end: '2026-11-03T07:30:00Z' },
    ])
    expect(startsOn(slots, '2026-11-03')).toHaveLength(3)
  })
})

describe('исключения', () => {
  it('исключение полностью заменяет расписание на дату', () => {
    const { slots } = computeSlots(
      input({
        availability: {
          weekly: {
            ...closedWeek,
            tuesday: [{ start: '09:00', end: '12:00' }],
          },
          overrides: [
            { date: '2026-11-03', ranges: [{ start: '14:00', end: '15:00' }] },
          ],
        },
      }),
    )

    expect(startsOn(slots, '2026-11-03')).toEqual(['14:00', '14:30'])
    // Следующий вторник без исключения — по расписанию
    expect(startsOn(slots, '2026-11-10')[0]).toBe('09:00')
  })

  it('исключение открывает дату, закрытую в расписании', () => {
    const { slots } = computeSlots(
      input({
        availability: {
          weekly: closedWeek,
          overrides: [
            { date: '2026-11-07', ranges: [{ start: '10:00', end: '11:00' }] },
          ],
        },
      }),
    )

    expect(startsOn(slots, '2026-11-07')).toEqual(['10:00', '10:30'])
  })

  it('закрытая дата слотов не даёт', () => {
    const { slots } = computeSlots(
      input({
        availability: {
          ...input().availability,
          overrides: [{ date: '2026-11-04', ranges: [] }],
        },
      }),
    )

    expect(startsOn(slots, '2026-11-04')).toEqual([])
    expect(startsOn(slots, '2026-11-05')).not.toEqual([])
  })
})

describe('переход на летнее время (Europe/Berlin)', () => {
  const berlin = (
    date: string,
    durationMinutes: 30 | 60,
    now: string,
  ): SlotInput =>
    input({
      eventType: { durationMinutes, slotStepMinutes: 30 },
      availability: {
        weekly: closedWeek,
        overrides: [{ date, ranges: [{ start: '01:00', end: '05:00' }] }],
      },
      now: new Date(now),
      timeZone: 'Europe/Berlin',
    })
  const slotsOn = (slots: Slot[], date: string) =>
    slots.filter(
      (slot) =>
        Temporal.Instant.from(slot.start)
          .toZonedDateTimeISO('Europe/Berlin')
          .toPlainDate()
          .toString() === date,
    )

  it('при переводе вперёд слотов, пересекающих несуществующий час 02:00–03:00, нет', () => {
    // 29 марта 2026 в 02:00 CET часы переводятся на 03:00 CEST
    const { slots } = computeSlots(
      berlin('2026-03-29', 60, '2026-03-23T08:00:00Z'),
    )

    expect(slotsOn(slots, '2026-03-29')).toEqual([
      // 01:00–02:00 CET кончается ровно в момент перевода и час не пересекает
      { start: '2026-03-29T00:00:00Z', end: '2026-03-29T01:00:00Z' },
      { start: '2026-03-29T01:00:00Z', end: '2026-03-29T02:00:00Z' },
      { start: '2026-03-29T01:30:00Z', end: '2026-03-29T02:30:00Z' },
      { start: '2026-03-29T02:00:00Z', end: '2026-03-29T03:00:00Z' },
    ])
  })

  it('при переводе назад повторяющийся час 02:00–03:00 даёт слоты один раз, по первому смещению', () => {
    // 25 октября 2026 в 03:00 CEST часы переводятся на 02:00 CET
    const { slots } = computeSlots(
      berlin('2026-10-25', 30, '2026-10-19T08:00:00Z'),
    )

    expect(slotsOn(slots, '2026-10-25').map((slot) => slot.start)).toEqual([
      '2026-10-24T23:00:00Z', // 01:00 CEST
      '2026-10-24T23:30:00Z',
      '2026-10-25T00:00:00Z', // 02:00 CEST, первое смещение
      '2026-10-25T00:30:00Z', // 02:30 CEST
      '2026-10-25T02:00:00Z', // 03:00 CET
      '2026-10-25T02:30:00Z',
      '2026-10-25T03:00:00Z',
      '2026-10-25T03:30:00Z', // 04:30 CET, конец в 05:00
    ])
  })

  it('при переводе назад слот, который кончается ровно в момент перевода, остаётся', () => {
    const { slots } = computeSlots(
      berlin('2026-10-25', 60, '2026-10-19T08:00:00Z'),
    )

    expect(slotsOn(slots, '2026-10-25')).toEqual([
      { start: '2026-10-24T23:00:00Z', end: '2026-10-25T00:00:00Z' },
      { start: '2026-10-24T23:30:00Z', end: '2026-10-25T00:30:00Z' },
      // 02:00–03:00 CEST, конец — момент перевода
      { start: '2026-10-25T00:00:00Z', end: '2026-10-25T01:00:00Z' },
      { start: '2026-10-25T00:30:00Z', end: '2026-10-25T01:30:00Z' },
      { start: '2026-10-25T02:00:00Z', end: '2026-10-25T03:00:00Z' },
      { start: '2026-10-25T02:30:00Z', end: '2026-10-25T03:30:00Z' },
      { start: '2026-10-25T03:00:00Z', end: '2026-10-25T04:00:00Z' },
    ])
  })
})

describe('расписание по умолчанию', () => {
  it('пока владелец не менял расписание, доступно пн–пт 9:00–18:00 по его поясу', () => {
    const slotService = createSlotService({
      schedule: createScheduleRepository(),
      bookings: createBookingRepository(),
      eventTypes: createEventTypeRepository(),
      // Понедельник 2 ноября, 00:00 по Екатеринбургу (UTC+5)
      now: () => new Date('2026-11-01T19:00:00Z'),
      timeZone: 'Asia/Yekaterinburg',
    })

    const { slots } = slotService.listSlots({
      durationMinutes: 60,
      slotStepMinutes: 60,
    })

    const ekb = (date: string) => startsOn(slots, date, 'Asia/Yekaterinburg')
    const workday = [
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ]
    for (const date of [
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]) {
      expect(ekb(date)).toEqual(workday)
    }
    expect(ekb('2026-11-07')).toEqual([])
    expect(ekb('2026-11-08')).toEqual([])
    expect(slots[0]).toEqual({
      start: '2026-11-02T04:00:00Z',
      end: '2026-11-02T05:00:00Z',
    })
  })
})
