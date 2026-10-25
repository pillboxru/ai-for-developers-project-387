import {
  ActionIcon,
  Button,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import {
  IconCalendarOff,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import type {
  Booking,
  BookingWindow,
  DateOverride,
} from '../../../api/generated/types.gen.ts'
import { PageEmptyState } from '../../../components/PageEmptyState.tsx'
import { dateKeyIn, formatDateKey } from '../../../format/dateTime.ts'
import { ConflictingBookings } from './ConflictingBookings.tsx'
import { OverrideModal } from './OverrideModal.tsx'
import { withOverrides } from './scheduleDraft.ts'

interface OverridesColumnProps {
  overrides: DateOverride[]
  // Новые исключения по возрастанию даты, как в черновике
  onChange: (overrides: DateOverride[]) => void
  bookingWindow: BookingWindow
  // Бронирования, которые черновик оставляет вне доступного времени
  conflicts: Booking[]
  timeZone: string
}

const titleId = 'schedule-overrides-title'

function hoursOf({ ranges }: DateOverride) {
  return ranges.length === 0
    ? 'Закрыта'
    : ranges.map(({ start, end }) => `${start}–${end}`).join(', ')
}

// Исключения на даты рядом с матрицей недели (31.1)
export function OverridesColumn({
  overrides,
  onChange,
  bookingWindow,
  conflicts,
  timeZone,
}: OverridesColumnProps) {
  const [showPast, setShowPast] = useState(false)
  // Открытая модалка: правка исключения или новое (editing: null). Модалка
  // монтируется на каждое открытие и не помнит прошлое
  const [modal, setModal] = useState<{ editing: DateOverride | null } | null>(
    null,
  )
  const openModal = (editing: DateOverride | null) => setModal({ editing })
  // Сегодня и конец окна по часам владельца — из окна записи, которое
  // посчитал сервер: так граница не зависит от часов браузера. Конец окна —
  // начало первого дня за ним. Даты 'YYYY-MM-DD' сравниваются строкой
  const today = dateKeyIn(bookingWindow.start, timeZone)
  const beyondWindow = dateKeyIn(bookingWindow.end, timeZone)
  const upcoming = overrides.filter((override) => override.date >= today)
  const past = overrides.filter((override) => override.date < today)

  // Бронирование мешает исключению своей даты, если начинается в неё по
  // часам владельца
  const cardConflicts = (date: string) =>
    conflicts.filter((booking) => dateKeyIn(booking.start, timeZone) === date)

  // Прошедшие уже отработали: сервер их не меняет, поэтому без кнопок
  const card = (override: DateOverride, readOnly: boolean) => (
    <Paper
      key={override.date}
      component="article"
      aria-label={formatDateKey(override.date)}
      withBorder
      p="xs"
      opacity={readOnly ? 0.6 : 1}
    >
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="sm" fw={500}>
            {formatDateKey(override.date)}
          </Text>
          <Text size="xs" c="dimmed">
            {hoursOf(override)}
            {override.date >= beyondWindow && ' · за окном записи'}
          </Text>
        </div>
        {!readOnly && (
          <Group gap={0} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Изменить"
              onClick={() => openModal(override)}
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="Удалить"
              onClick={() =>
                onChange(
                  overrides.filter(
                    (candidate) => candidate.date !== override.date,
                  ),
                )
              }
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        )}
      </Group>
      {cardConflicts(override.date).length > 0 && (
        <Text component="div" c="orange" mt={4}>
          <ConflictingBookings
            bookings={cardConflicts(override.date)}
            timeZone={timeZone}
          />
        </Text>
      )}
    </Paper>
  )

  return (
    <Paper component="section" aria-labelledby={titleId} withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Title id={titleId} order={2} size="h4">
          Исключения
        </Title>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => openModal(null)}
        >
          Добавить
        </Button>
      </Group>
      <Stack gap="xs">
        {upcoming.length === 0 && (
          <PageEmptyState
            icon={IconCalendarOff}
            title="Исключений нет"
            description="Добавьте дату, на которую часы отличаются от расписания."
          />
        )}
        {upcoming.map((override) => card(override, false))}
        {past.length > 0 && (
          <>
            <UnstyledButton onClick={() => setShowPast((shown) => !shown)}>
              <Text size="xs" c="dimmed">
                {showPast ? 'Скрыть прошедшие' : `Прошедшие (${past.length})`}
              </Text>
            </UnstyledButton>
            <Collapse expanded={showPast}>
              <Stack gap="xs">
                {past.map((override) => card(override, true))}
              </Stack>
            </Collapse>
          </>
        )}
      </Stack>
      {modal && (
        <OverrideModal
          opened
          editing={modal.editing}
          overrides={overrides}
          minDate={today}
          onClose={() => setModal(null)}
          onSave={(dates, ranges) =>
            onChange(withOverrides(overrides, dates, ranges))
          }
        />
      )}
    </Paper>
  )
}
