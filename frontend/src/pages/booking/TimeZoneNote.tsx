import { Group, Text } from '@mantine/core'
import { IconWorld } from '@tabler/icons-react'

interface TimeZoneNoteProps {
  guestTimeZone: string
  ownerTimeZone: string
}

// Пояс подписан IANA-именем: ручного переключения нет, гость должен понять,
// по каким часам показано время
export function TimeZoneNote({
  guestTimeZone,
  ownerTimeZone,
}: TimeZoneNoteProps) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <IconWorld size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <Text size="sm" c="dimmed">
        {guestTimeZone === ownerTimeZone
          ? `Время указано по поясу ${guestTimeZone}`
          : `Время показано по вашему поясу: ${guestTimeZone}. Владелец работает по ${ownerTimeZone}.`}
      </Text>
    </Group>
  )
}
