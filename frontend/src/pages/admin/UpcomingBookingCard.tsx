import {
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import type { Booking } from '../../api/generated/types.gen.ts'
import { formatTime } from '../../format/dateTime.ts'

interface UpcomingBookingCardProps {
  booking: Booking
  ownerTimeZone: string
  now: Date
  onCancel: (booking: Booking) => void
}

export function UpcomingBookingCard({
  booking,
  ownerTimeZone,
  now,
  onCancel,
}: UpcomingBookingCardProps) {
  // По часам браузера (27.1): сервер отдаёт идущий звонок в списке, но
  // признака «идёт» в контракте нет. Отменённый звонок не идёт, даже если
  // его время ещё не кончилось
  const inProgress =
    !booking.cancelled &&
    new Date(booking.start).getTime() <= now.getTime() &&
    now.getTime() < new Date(booking.end).getTime()

  return (
    // Отменённое остаётся на месте приглушённым (28.4): владелец сам напишет
    // гостю, поэтому email по-прежнему ссылка
    <Paper
      component="article"
      withBorder
      p="md"
      radius="md"
      opacity={booking.cancelled ? 0.6 : undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={6}>
          <Group gap="sm">
            <Title order={3} size="h4">
              {formatTime(booking.start, ownerTimeZone)}–
              {formatTime(booking.end, ownerTimeZone)}
            </Title>
            {inProgress && (
              <Badge variant="light" color="green">
                Идёт сейчас
              </Badge>
            )}
            {booking.cancelled && (
              <Badge variant="light" color="red">
                Отменено
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Text fw={500}>{booking.eventType.title}</Text>
            {booking.eventType.hidden && (
              <Badge variant="light" color="gray">
                Скрыт
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Text>{booking.name}</Text>
            <Anchor href={`mailto:${booking.email}`}>{booking.email}</Anchor>
          </Group>
          {booking.comment && (
            <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-line' }}>
              {booking.comment}
            </Text>
          )}
        </Stack>
        {!booking.cancelled && (
          <Button variant="default" size="xs" onClick={() => onCancel(booking)}>
            Отменить
          </Button>
        )}
      </Group>
    </Paper>
  )
}
