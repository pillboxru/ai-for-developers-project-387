import {
  Button,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useId } from 'react'
import type { Slot } from '../../api/generated/types.gen.ts'
import { formatDateKey, formatTime, hourIn } from '../../format/dateTime.ts'

// Части дня по часам гостя: с какого часа включительно и до какого
const dayParts = [
  { label: 'Утро', from: 0, to: 12 },
  { label: 'День', from: 12, to: 17 },
  { label: 'Вечер', from: 17, to: 24 },
]

interface DaySlotsProps {
  // Дата гостя 'YYYY-MM-DD'
  date: string
  slots: Slot[]
  guestTimeZone: string
  onSelect: (slot: Slot) => void
}

function DayPart({
  label,
  slots,
  guestTimeZone,
  onSelect,
}: Omit<DaySlotsProps, 'date'> & { label: string }) {
  const labelId = useId()
  return (
    <Stack gap="xs" role="group" aria-labelledby={labelId}>
      <Text id={labelId} fw={600} c="dimmed" size="sm">
        {label}
      </Text>
      <SimpleGrid cols={2} spacing="xs">
        {slots.map((slot) => (
          <Button
            key={slot.start}
            variant="outline"
            onClick={() => onSelect(slot)}
          >
            {formatTime(slot.start, guestTimeZone)}
          </Button>
        ))}
      </SimpleGrid>
    </Stack>
  )
}

// Слоты выбранной даты гостя, сгруппированные по частям дня
export function DaySlots({ date, slots, ...partProps }: DaySlotsProps) {
  return (
    <Stack gap="sm">
      <Title order={2} size="h5">
        {formatDateKey(date)}
      </Title>
      {/* Полоса прокрутки рисуется поверх содержимого и закрывала правую
          колонку слотов: отступ появляется только вместе с полосой */}
      <ScrollArea.Autosize mah={380} offsetScrollbars="present">
        <Stack gap="md">
          {dayParts.map(({ label, from, to }) => {
            const partSlots = slots.filter((slot) => {
              const hour = hourIn(slot.start, partProps.guestTimeZone)
              return hour >= from && hour < to
            })
            return (
              partSlots.length > 0 && (
                <DayPart
                  key={label}
                  label={label}
                  slots={partSlots}
                  {...partProps}
                />
              )
            )
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  )
}
