import { Button, Group, Text } from '@mantine/core'
import { IconArrowLeft, IconCalendarEvent } from '@tabler/icons-react'
import type { Slot } from '../../api/generated/types.gen.ts'
import { formatSlotTime } from '../../format/dateTime.ts'

interface SelectedSlotProps {
  slot: Slot
  guestTimeZone: string
  onBack: () => void
}

// Под типом события, пока гость заполняет форму: на что он записывается
export function SelectedSlot({
  slot,
  guestTimeZone,
  onBack,
}: SelectedSlotProps) {
  return (
    <>
      <Group gap={6} wrap="nowrap">
        <IconCalendarEvent size={16} style={{ flexShrink: 0 }} />
        <Text size="sm" fw={600}>
          {formatSlotTime(slot, guestTimeZone)}
        </Text>
      </Group>
      <Group>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconArrowLeft size={14} />}
          onClick={onBack}
        >
          Назад
        </Button>
      </Group>
    </>
  )
}
