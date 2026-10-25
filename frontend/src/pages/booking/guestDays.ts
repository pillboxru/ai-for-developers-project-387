import type { Slot, SlotList } from '../../api/generated/types.gen.ts'
import { dateKeyIn } from '../../format/dateTime.ts'

export interface GuestDays {
  // Первая и последняя даты гостя, на которые выпадает хотя бы один момент
  // окна записи. Окно задано по часам владельца, поэтому у гостя из другого
  // пояса оно может задевать на дату больше
  minDate: string
  maxDate: string
  // Слоты по датам гостя ('YYYY-MM-DD') в порядке времени; дат без слотов нет
  slotsByDate: Map<string, Slot[]>
}

export function guestDays(slotList: SlotList, timeZone: string): GuestDays {
  const { bookingWindow, slots } = slotList
  // Конец окна не входит в него: последний момент окна на миллисекунду раньше
  const lastMoment = new Date(new Date(bookingWindow.end).getTime() - 1)
  const slotsByDate = new Map<string, Slot[]>()
  for (const slot of slots) {
    const date = dateKeyIn(slot.start, timeZone)
    slotsByDate.set(date, [...(slotsByDate.get(date) ?? []), slot])
  }
  return {
    minDate: dateKeyIn(bookingWindow.start, timeZone),
    maxDate: dateKeyIn(lastMoment, timeZone),
    slotsByDate,
  }
}
