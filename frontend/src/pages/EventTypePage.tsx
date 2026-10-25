import { Container } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { isApiError } from '../api/errors.ts'
import { eventTypeQuery } from '../api/eventTypes.ts'
import { ownerQuery } from '../api/owner.ts'
import { slotsQuery } from '../api/slots.ts'
import { EventTypeNotFound } from '../components/EventTypeNotFound.tsx'
import { QueryContent } from '../components/QueryContent.tsx'
import { browserTimeZone } from '../format/dateTime.ts'
import { BookingFlow } from './booking/BookingFlow.tsx'

// 404 — тип скрыт или удалён, 400 — в адресе не UUID. Для гостя это одна
// и та же битая ссылка: повтор тут не поможет, нужен другой тип
function isMissingEventType(error: unknown) {
  return (
    isApiError(error) &&
    (error.code === 'not_found' || error.code === 'validation_error')
  )
}

export function EventTypePage() {
  const { eventTypeId } = useParams()
  // Маршрут /book/:eventTypeId без параметра не совпадает
  if (eventTypeId === undefined) {
    throw new Error('EventTypePage вне маршрута /book/:eventTypeId')
  }
  // Три запроса идут параллельно: левая колонка не ждёт слотов
  const eventType = useQuery(eventTypeQuery(eventTypeId))
  const owner = useQuery(ownerQuery())
  const slots = useQuery(slotsQuery(eventTypeId))
  const guestTimeZone = browserTimeZone()
  // Бронирование ответило 404: тип скрыли или удалили, пока гость
  // заполнял форму. Исход тот же, что у прямой ссылки на такой тип
  const [eventTypeGone, setEventTypeGone] = useState(false)

  return (
    <Container size="lg" py="xl">
      {eventTypeGone ||
      isMissingEventType(eventType.error) ||
      isMissingEventType(slots.error) ? (
        <EventTypeNotFound />
      ) : (
        <QueryContent query={eventType}>
          {(eventTypeData) => (
            <QueryContent query={owner}>
              {(ownerData) => (
                <BookingFlow
                  eventType={eventTypeData}
                  owner={ownerData}
                  slots={slots}
                  guestTimeZone={guestTimeZone}
                  onEventTypeGone={() => setEventTypeGone(true)}
                />
              )}
            </QueryContent>
          )}
        </QueryContent>
      )}
    </Container>
  )
}
