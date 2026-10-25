import { useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { invalidateSlots } from '../../api/slots.ts'
import type {
  Booking,
  Owner,
  PublicEventType,
  Slot,
  SlotList,
} from '../../api/generated/types.gen.ts'
import { QueryContent } from '../../components/QueryContent.tsx'
import { dateKeyIn } from '../../format/dateTime.ts'
import { BookingCard } from './BookingCard.tsx'
import { BookingConfirmation } from './BookingConfirmation.tsx'
import { BookingForm } from './BookingForm.tsx'
import { EventTypeSummary } from './EventTypeSummary.tsx'
import { emptyGuestDetails } from './guestDetails.ts'
import { NoFreeTime } from './NoFreeTime.tsx'
import { SelectedSlot } from './SelectedSlot.tsx'
import { SlotPicker } from './SlotPicker.tsx'

interface BookingFlowProps {
  eventType: PublicEventType
  owner: Owner
  slots: UseQueryResult<SlotList, unknown>
  guestTimeZone: string
  onEventTypeGone: () => void
}

// Сравниваются моменты, а не строки: в адресе может оказаться тот же момент
// в другой записи, например с миллисекундами
function findSlot(slots: Slot[], start: string) {
  const time = new Date(start).getTime()
  return slots.find((slot) => new Date(slot.start).getTime() === time)
}

function withoutSlot(prev: URLSearchParams) {
  const next = new URLSearchParams(prev)
  next.delete('slot')
  return next
}

// Путь гостя в одной карточке: выбор слота → форма → подтверждение. Левая
// колонка остаётся, меняется правая часть. Выбранный слот живёт
// в адресе (?slot=), поэтому перезагрузка открывает форму снова (11.2)
export function BookingFlow({
  eventType,
  owner,
  slots,
  guestTimeZone,
  onEventTypeGone,
}: BookingFlowProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const slotParam = searchParams.get('slot')
  const selectedSlot =
    slotParam === null || slots.data === undefined
      ? undefined
      : findSlot(slots.data.slots, slotParam)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slotUnavailable, setSlotUnavailable] = useState(false)
  const [guestDetails, setGuestDetails] = useState(emptyGuestDetails)
  // Подтверждение живёт только в памяти страницы: своего адреса у него нет
  const [booking, setBooking] = useState<Booking | null>(null)
  const queryClient = useQueryClient()

  // Слот из адреса заняли, он прошёл или его и не было: гость выбирает заново
  const staleSlotParam =
    slotParam !== null && slots.data !== undefined && selectedSlot === undefined
  useEffect(() => {
    if (!staleSlotParam) {
      return
    }
    setSlotUnavailable(true)
    setSearchParams(withoutSlot, { replace: true })
  }, [staleSlotParam, setSearchParams])

  // Новая запись в истории: «назад» браузера возвращает к выбору слота.
  // Дата запоминается, потому что календарь на время формы размонтируется
  function selectSlot(slot: Slot) {
    setSlotUnavailable(false)
    setSelectedDate(dateKeyIn(slot.start, guestTimeZone))
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('slot', slot.start)
      return next
    })
  }

  // После перезагрузки с ?slot= дата ещё не запомнена: берём её из слота
  function backToSlots(slot: Slot) {
    setSelectedDate(dateKeyIn(slot.start, guestTimeZone))
    setSearchParams(withoutSlot, { replace: true })
  }

  // Слот из адреса убирается: после перезагрузки гость снова на выборе
  // слота, а не на подтверждении или отказе в уже занятом им времени
  function showConfirmation(created: Booking) {
    setBooking(created)
    setSearchParams(withoutSlot, { replace: true })
    void invalidateSlots(queryClient, eventType.id)
  }

  // Гость снова на выборе слота той же даты, слоты перечитываются: занятое
  // время из них уйдёт. Введённые данные остаются в guestDetails
  function rejectSlot(slot: Slot) {
    setSelectedDate(dateKeyIn(slot.start, guestTimeZone))
    setSlotUnavailable(true)
    setSearchParams(withoutSlot, { replace: true })
    void invalidateSlots(queryClient, eventType.id)
  }

  return (
    <BookingCard
      aside={
        <EventTypeSummary
          owner={owner}
          eventType={eventType}
          guestTimeZone={guestTimeZone}
        >
          {/* После подтверждения возвращаться к выбору не к чему */}
          {selectedSlot && !booking && (
            <SelectedSlot
              slot={selectedSlot}
              guestTimeZone={guestTimeZone}
              onBack={() => backToSlots(selectedSlot)}
            />
          )}
        </EventTypeSummary>
      }
    >
      {booking ? (
        <BookingConfirmation
          booking={booking}
          owner={owner}
          guestTimeZone={guestTimeZone}
        />
      ) : (
        <QueryContent query={slots}>
          {(slotList) =>
            selectedSlot ? (
              <BookingForm
                eventTypeId={eventType.id}
                slot={selectedSlot}
                guestDetails={guestDetails}
                onGuestDetailsChange={setGuestDetails}
                onBooked={showConfirmation}
                onSlotUnavailable={() => rejectSlot(selectedSlot)}
                onEventTypeGone={onEventTypeGone}
              />
            ) : slotList.slots.length === 0 ? (
              <NoFreeTime />
            ) : (
              <SlotPicker
                slotList={slotList}
                guestTimeZone={guestTimeZone}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                slotUnavailable={slotUnavailable}
                onCloseSlotUnavailable={() => setSlotUnavailable(false)}
                onSelect={selectSlot}
              />
            )
          }
        </QueryContent>
      )}
    </BookingCard>
  )
}
