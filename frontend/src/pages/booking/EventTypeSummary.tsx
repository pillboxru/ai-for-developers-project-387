import { Avatar, Group, Stack, Text, Title } from '@mantine/core'
import { IconClockHour4 } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { Owner, PublicEventType } from '../../api/generated/types.gen.ts'
import { formatDuration } from '../../format/duration.ts'
import { TimeZoneNote } from './TimeZoneNote.tsx'

interface EventTypeSummaryProps {
  owner: Owner
  eventType: PublicEventType
  guestTimeZone: string
  // Под описанием: например, выбранное время и «Назад» у формы бронирования
  children?: ReactNode
}

// Левая колонка карточки записи: к кому и на какой звонок записывается гость
export function EventTypeSummary({
  owner,
  eventType,
  guestTimeZone,
  children,
}: EventTypeSummaryProps) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Avatar name={owner.name} color="initials" size="sm" />
        <Text size="sm" c="dimmed">
          {owner.name}
        </Text>
      </Group>
      <Title order={1} size="h3">
        {eventType.title}
      </Title>
      <Group gap={6}>
        <IconClockHour4 size={16} />
        <Text size="sm">{formatDuration(eventType.durationMinutes)}</Text>
      </Group>
      {eventType.description && (
        // Простой текст с переносами строк владельца, как в списке типов
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-line' }}>
          {eventType.description}
        </Text>
      )}
      <TimeZoneNote
        guestTimeZone={guestTimeZone}
        ownerTimeZone={owner.timeZone}
      />
      {children}
    </Stack>
  )
}
