import { Stack, Text } from '@mantine/core'
import type { Booking } from '../../../api/generated/types.gen.ts'
import { formatSlotTime } from '../../../format/dateTime.ts'

interface ConflictingBookingsProps {
  bookings: Booking[]
  timeZone: string
}

// Бронирования, которые мешают сохранить расписание: время по часам
// владельца, гость и тип события
export function ConflictingBookings({
  bookings,
  timeZone,
}: ConflictingBookingsProps) {
  return (
    <Stack gap={2}>
      {bookings.map((booking) => (
        <Text key={booking.id} size="sm">
          {`${formatSlotTime(booking, timeZone)} — ${booking.name} (${booking.eventType.title})`}
        </Text>
      ))}
    </Stack>
  )
}
