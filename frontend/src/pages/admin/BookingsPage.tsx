import { Container, Group, Stack, Text, Title } from '@mantine/core'
import { IconCalendarEvent, IconWorld } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { watchedBookingsQuery } from '../../api/bookings.ts'
import type { Booking } from '../../api/generated/types.gen.ts'
import { ownerQuery } from '../../api/owner.ts'
import { PageEmptyState } from '../../components/PageEmptyState.tsx'
import { QueryContent } from '../../components/QueryContent.tsx'
import { bookingDays, type BookingDay } from './bookingDays.ts'
import { CancelBookingModal } from './CancelBookingModal.tsx'
import { UpcomingBookingCard } from './UpcomingBookingCard.tsx'

export function BookingsPage() {
  const bookings = useQuery(watchedBookingsQuery())
  const owner = useQuery(ownerQuery())

  return (
    <Container size="lg" py="xl">
      <Title order={1}>Бронирования</Title>
      <QueryContent query={owner}>
        {({ timeZone }) => (
          <BookingsContent bookings={bookings} ownerTimeZone={timeZone} />
        )}
      </QueryContent>
    </Container>
  )
}

function BookingsContent({
  bookings,
  ownerTimeZone,
}: {
  bookings: UseQueryResult<Booking[]>
  ownerTimeZone: string
}) {
  const [cancelOpened, cancelModal] = useDisclosure(false)
  // Остаётся заданным и после закрытия: модалка показывает бронирование,
  // пока уходит с экрана
  const [cancelling, setCancelling] = useState<Booking>()
  const openCancel = (booking: Booking) => {
    setCancelling(booking)
    cancelModal.open()
  }

  return (
    <>
      <QueryContent query={bookings}>
        {(list) =>
          list.length === 0 ? (
            <PageEmptyState
              icon={IconCalendarEvent}
              title="Предстоящих бронирований нет"
              description="Здесь появятся бронирования гостей."
            />
          ) : (
            <UpcomingBookings
              bookings={list}
              ownerTimeZone={ownerTimeZone}
              loadedAt={bookings.dataUpdatedAt}
              onCancel={openCancel}
            />
          )
        }
      </QueryContent>
      {/* Вне списка: опрос мог его опустошить, а подтверждение отмены
          закончившегося звонка должно дойти до уведомления */}
      {cancelling && (
        <CancelBookingModal
          opened={cancelOpened}
          onClose={cancelModal.close}
          booking={cancelling}
          ownerTimeZone={ownerTimeZone}
        />
      )}
    </>
  )
}

function UpcomingBookings({
  bookings,
  ownerTimeZone,
  loadedAt,
  onCancel,
}: {
  bookings: Booking[]
  ownerTimeZone: string
  // Когда пришёл список, мс от эпохи
  loadedAt: number
  onCancel: (booking: Booking) => void
}) {
  // «Сегодня» и «Идёт сейчас» считаются на момент загрузки списка: почти тот
  // же момент, по которому сервер отобрал предстоящие. Список опрашивается
  // (watchedBookingsQuery), и вместе с ним сдвигается now, поэтому пометка
  // и дни отстают от реальности не больше интервала опроса
  const now = new Date(loadedAt)

  return (
    <Stack mt="lg" gap="xl">
      <Group gap={6}>
        <IconWorld size={16} />
        <Text size="sm" c="dimmed">
          Время указано по поясу {ownerTimeZone}
        </Text>
      </Group>
      {bookingDays(bookings, ownerTimeZone, now).map((day) => (
        <DaySection
          key={day.date}
          day={day}
          ownerTimeZone={ownerTimeZone}
          now={now}
          onCancel={onCancel}
        />
      ))}
    </Stack>
  )
}

function DaySection({
  day,
  ownerTimeZone,
  now,
  onCancel,
}: {
  day: BookingDay
  ownerTimeZone: string
  now: Date
  onCancel: (booking: Booking) => void
}) {
  const headingId = useId()

  return (
    <Stack component="section" aria-labelledby={headingId} gap="sm">
      <Title order={2} size="h3" id={headingId}>
        {day.label}
      </Title>
      {day.bookings.map((booking) => (
        <UpcomingBookingCard
          key={booking.id}
          booking={booking}
          ownerTimeZone={ownerTimeZone}
          now={now}
          onCancel={onCancel}
        />
      ))}
    </Stack>
  )
}
