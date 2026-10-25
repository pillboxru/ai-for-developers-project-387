import { Button, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Booking, Owner } from '../../api/generated/types.gen.ts'
import { formatSlotTime } from '../../format/dateTime.ts'
import { TimeZoneNote } from './TimeZoneNote.tsx'

interface BookingConfirmationProps {
  booking: Booking
  owner: Owner
  guestTimeZone: string
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      {children}
    </Stack>
  )
}

// На месте формы после 201. Своего адреса нет (15.2): бронирование гостю
// больше нигде не показать, поэтому все детали собраны здесь
export function BookingConfirmation({
  booking,
  owner,
  guestTimeZone,
}: BookingConfirmationProps) {
  const titleId = useId()
  return (
    <Stack component="section" aria-labelledby={titleId} gap="md" p="lg">
      <Group gap="sm">
        <ThemeIcon color="green" radius="xl" size="lg">
          <IconCheck size={20} />
        </ThemeIcon>
        <Title id={titleId} order={2} size="h3">
          Вы записаны
        </Title>
      </Group>
      <Detail label="Тип события">
        <Text fw={600}>{booking.eventType.title}</Text>
      </Detail>
      <Detail label="Когда">
        <Text>{formatSlotTime(booking, guestTimeZone)}</Text>
        <TimeZoneNote
          guestTimeZone={guestTimeZone}
          ownerTimeZone={owner.timeZone}
        />
      </Detail>
      <Detail label="Владелец">
        <Text>{owner.name}</Text>
      </Detail>
      <Detail label="Имя">
        <Text>{booking.name}</Text>
      </Detail>
      <Detail label="Email">
        <Text>{booking.email}</Text>
      </Detail>
      {booking.comment && (
        <Detail label="Комментарий">
          <Text style={{ whiteSpace: 'pre-line' }}>{booking.comment}</Text>
        </Detail>
      )}
      <Text>Владелец пришлёт ссылку на звонок на {booking.email}</Text>
      <Text size="sm" c="dimmed">
        Это подтверждение не сохранится после закрытия страницы
      </Text>
      <Group>
        <Button component={Link} to="/book">
          Записаться ещё
        </Button>
        <Button component={Link} to="/" variant="default">
          На главную
        </Button>
      </Group>
    </Stack>
  )
}
