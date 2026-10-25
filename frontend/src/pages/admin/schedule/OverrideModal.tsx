import {
  ActionIcon,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { DatePicker, DatesProvider } from '@mantine/dates'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import 'dayjs/locale/ru'
import { useState } from 'react'
import type {
  DateOverride,
  TimeRange,
} from '../../../api/generated/types.gen.ts'
import { formatDateKey } from '../../../format/dateTime.ts'
import {
  cellMinutes,
  cellsPerDay,
  cellsToRanges,
  minutesOf,
  rangesToCells,
  timeOf,
} from './scheduleDraft.ts'

interface OverrideModalProps {
  opened: boolean
  // Правка одного исключения: дата фиксирована. null — новое исключение
  editing: DateOverride | null
  // Все исключения черновика: их даты подчёркнуты в календаре
  overrides: DateOverride[]
  // Сегодня по часам владельца: прошедшие даты недоступны
  minDate: string
  onClose: () => void
  onSave: (dates: string[], ranges: TimeRange[]) => void
}

const calendarLabels = {
  previousMonth: 'Предыдущий месяц',
  nextMonth: 'Следующий месяц',
}

const dayMinutes = 24 * 60
const workday: TimeRange = { start: '09:00', end: '18:00' }

// Шаг 30 минут, как у матрицы: начала с 00:00, концы до 24:00
const startOptions = Array.from({ length: cellsPerDay }, (_, cell) =>
  timeOf(cell * cellMinutes),
)
const endOptions = Array.from({ length: cellsPerDay }, (_, cell) =>
  timeOf((cell + 1) * cellMinutes),
)

function RangesEditor({
  value,
  onChange,
}: {
  value: TimeRange[]
  onChange: (ranges: TimeRange[]) => void
}) {
  const update = (index: number, patch: Partial<TimeRange>) =>
    onChange(
      value.map((range, current) => {
        if (current !== index) {
          return range
        }
        const next = { ...range, ...patch }
        // Конец всегда позже начала: иначе промежуток пуст
        return minutesOf(next.end) > minutesOf(next.start)
          ? next
          : { ...next, end: timeOf(minutesOf(next.start) + cellMinutes) }
      }),
    )
  const add = () => {
    const last = value.at(-1)
    const start = last ? Math.min(minutesOf(last.end) + 60, 23 * 60) : 9 * 60
    onChange([
      ...value,
      { start: timeOf(start), end: timeOf(Math.min(start + 60, dayMinutes)) },
    ])
  }

  return (
    <Stack gap={6}>
      {value.map((range, index) => (
        <Group key={index} gap={6} wrap="nowrap">
          <Select
            size="xs"
            w={90}
            aria-label="Начало"
            data={startOptions}
            value={range.start}
            allowDeselect={false}
            onChange={(start) => start && update(index, { start })}
          />
          <Text size="sm">—</Text>
          <Select
            size="xs"
            w={90}
            aria-label="Конец"
            data={endOptions.filter(
              (end) => minutesOf(end) > minutesOf(range.start),
            )}
            value={range.end}
            allowDeselect={false}
            onChange={(end) => end && update(index, { end })}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Удалить промежуток"
            onClick={() =>
              onChange(value.filter((_, current) => current !== index))
            }
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        size="xs"
        variant="subtle"
        leftSection={<IconPlus size={14} />}
        w="fit-content"
        onClick={add}
      >
        Добавить промежуток
      </Button>
    </Stack>
  )
}

// Исключение на даты: закрыть их или открыть свои часы (31.2). Новое можно
// задать сразу на несколько дат — например, на отпуск
export function OverrideModal({
  opened,
  editing,
  overrides,
  minDate,
  onClose,
  onSave,
}: OverrideModalProps) {
  // Значения берутся при монтировании: колонка монтирует модалку на каждое
  // открытие
  const [dates, setDates] = useState(editing ? [editing.date] : [])
  const [closed, setClosed] = useState(
    editing ? editing.ranges.length === 0 : true,
  )
  const [ranges, setRanges] = useState(
    editing && editing.ranges.length > 0 ? editing.ranges : [workday],
  )
  const overrideDates = new Set(overrides.map((override) => override.date))

  const save = () => {
    // Пересекающиеся и соприкасающиеся промежутки сливаются, как в матрице:
    // сервер их не примет
    onSave(dates, closed ? [] : cellsToRanges(rangesToCells(ranges)))
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        editing
          ? `Исключение: ${formatDateKey(editing.date)}`
          : 'Новое исключение'
      }
      size="auto"
    >
      <Group align="flex-start" gap="xl">
        {!editing && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Даты
            </Text>
            <DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1 }}>
              <DatePicker
                type="multiple"
                value={dates}
                onChange={setDates}
                minDate={minDate}
                maxLevel="month"
                ariaLabels={calendarLabels}
                getDayProps={(date) =>
                  overrideDates.has(date)
                    ? { style: { textDecoration: 'underline' } }
                    : {}
                }
              />
            </DatesProvider>
            <Text size="xs" c="dimmed" maw={260}>
              Подчёркнуты даты, у которых уже есть исключение: оно заменится.
            </Text>
          </Stack>
        )}
        <Stack gap="sm" w={300}>
          <SegmentedControl
            value={closed ? 'closed' : 'hours'}
            onChange={(value) => setClosed(value === 'closed')}
            data={[
              { value: 'closed', label: 'Закрыть дату' },
              { value: 'hours', label: 'Свои часы' },
            ]}
          />
          {closed ? (
            <Text size="sm" c="dimmed">
              Гости не смогут записаться на эти даты.
            </Text>
          ) : (
            <RangesEditor value={ranges} onChange={setRanges} />
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button disabled={dates.length === 0} onClick={save}>
              Готово
            </Button>
          </Group>
        </Stack>
      </Group>
    </Modal>
  )
}
