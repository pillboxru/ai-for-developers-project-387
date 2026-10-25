import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Paper,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconDots } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { formatSlotTime } from '../../../format/dateTime.ts'
import type { BookingMark } from './bookingMarks.ts'
import {
  cellMinutes,
  cellsPerDay,
  timeOf,
  weekdays,
  type DayCells,
} from './scheduleDraft.ts'

const workdays = [0, 1, 2, 3, 4]
const allDays = [0, 1, 2, 3, 4, 5, 6]

const closedDay = (): DayCells =>
  Array.from({ length: cellsPerDay }, () => false)

interface WeekMatrixProps {
  weekly: DayCells[]
  onChange: (weekly: DayCells[]) => void
  marks: BookingMark[]
  timeZone: string
}

// Выделение мышью: от ячейки, где нажали, до ячейки под курсором
interface Selection {
  fromDay: number
  fromRow: number
  toDay: number
  toRow: number
  // Что станет с ячейками: первая ячейка решает, открыть или закрыть (30.2)
  open: boolean
}

function contains(selection: Selection, day: number, row: number) {
  return (
    day >= Math.min(selection.fromDay, selection.toDay) &&
    day <= Math.max(selection.fromDay, selection.toDay) &&
    row >= Math.min(selection.fromRow, selection.toRow) &&
    row <= Math.max(selection.fromRow, selection.toRow)
  )
}

const cellHeight = 14
// Строки 06:00–23:00: ночью владелец почти никогда не открыт, а сутки
// целиком не помещаются на экран
const dayRows = { first: 12, last: 46 }
const allRows = { first: 0, last: cellsPerDay }

export function WeekMatrix({
  weekly,
  onChange,
  marks,
  timeZone,
}: WeekMatrixProps) {
  const [showNight, setShowNight] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)

  // Кнопку отпускают где угодно, в том числе за матрицей: выделение
  // применяется по отпусканию на всём окне
  useEffect(() => {
    if (!selection) {
      return
    }
    const apply = () => {
      onChange(
        weekly.map((cells, day) =>
          cells.map((open, row) =>
            contains(selection, day, row) ? selection.open : open,
          ),
        ),
      )
      setSelection(null)
    }
    window.addEventListener('mouseup', apply)
    return () => window.removeEventListener('mouseup', apply)
  }, [selection, weekly, onChange])

  const { first, last } = showNight ? allRows : dayRows
  const rows = Array.from({ length: last - first }, (_, i) => first + i)

  const copyDay = (from: number, targets: number[]) =>
    onChange(
      weekly.map((cells, day) =>
        targets.includes(day) ? [...weekly[from]] : cells,
      ),
    )
  const clearDay = (target: number) =>
    onChange(weekly.map((cells, day) => (day === target ? closedDay() : cells)))

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <div>
          <Title order={2} size="h4">
            Неделя
          </Title>
          <Text size="xs" c="dimmed">
            Зажмите мышь и протяните, чтобы открыть или закрыть время.
          </Text>
        </div>
        <Switch
          size="xs"
          label="Ночные часы"
          checked={showNight}
          onChange={(event) => setShowNight(event.currentTarget.checked)}
        />
      </Group>
      <Box
        role="grid"
        aria-label="Неделя"
        style={{
          display: 'grid',
          gridTemplateColumns: '44px repeat(7, 1fr)',
          userSelect: 'none',
        }}
      >
        <div role="row" style={{ display: 'contents' }}>
          <div role="columnheader" />
          {weekdays.map((weekday, day) => (
            <Group
              key={weekday.key}
              role="columnheader"
              gap={0}
              justify="center"
              wrap="nowrap"
              pb={4}
            >
              <Text size="sm" fw={600}>
                {weekday.short}
              </Text>
              <Menu position="bottom" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    aria-label={`Действия: ${weekday.long}`}
                  >
                    <IconDots size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Копировать на</Menu.Label>
                  <Menu.Item onClick={() => copyDay(day, workdays)}>
                    Все будни
                  </Menu.Item>
                  <Menu.Item onClick={() => copyDay(day, allDays)}>
                    Все дни
                  </Menu.Item>
                  {weekdays.map((target, targetDay) =>
                    targetDay === day ? null : (
                      <Menu.Item
                        key={target.key}
                        onClick={() => copyDay(day, [targetDay])}
                      >
                        {target.long}
                      </Menu.Item>
                    ),
                  )}
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={() => clearDay(day)}>
                    Очистить день
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row} role="row" style={{ display: 'contents' }}>
            <Text
              role="rowheader"
              size="10px"
              c="dimmed"
              ta="right"
              pr={6}
              style={{
                lineHeight: `${cellHeight}px`,
                transform: 'translateY(-7px)',
              }}
            >
              {row % 2 === 0 ? timeOf(row * cellMinutes) : ''}
            </Text>
            {weekdays.map((weekday, day) => {
              const selected = selection && contains(selection, day, row)
              const open = selected ? selection.open : weekly[day][row]
              const from = row * cellMinutes
              const here = marks.filter(
                (mark) =>
                  mark.day === day &&
                  mark.from < from + cellMinutes &&
                  from < mark.to,
              )
              const conflict = here.some((mark) => mark.outside)
              const cell = (
                <Box
                  key={weekday.key}
                  onMouseDown={(event) => {
                    // Без этого браузер начинает выделять текст страницы
                    event.preventDefault()
                    setSelection({
                      fromDay: day,
                      fromRow: row,
                      toDay: day,
                      toRow: row,
                      open: !weekly[day][row],
                    })
                  }}
                  onMouseEnter={() =>
                    selection &&
                    setSelection({ ...selection, toDay: day, toRow: row })
                  }
                  role="gridcell"
                  aria-label={`${weekday.long}, ${timeOf(row * cellMinutes)}`}
                  aria-selected={open}
                  h={cellHeight}
                  style={{
                    cursor: 'pointer',
                    background: open
                      ? 'var(--mantine-color-indigo-filled)'
                      : 'var(--mantine-color-default)',
                    opacity: selected ? 0.7 : 1,
                    borderTop:
                      row % 2 === 0
                        ? '1px solid var(--mantine-color-default-border)'
                        : '1px dashed var(--mantine-color-default-border)',
                    borderLeft: '1px solid var(--mantine-color-default-border)',
                    boxShadow:
                      here.length > 0
                        ? `inset 4px 0 0 var(--mantine-color-${conflict ? 'orange' : 'teal'}-5)`
                        : undefined,
                  }}
                />
              )
              return here.length > 0 ? (
                <Tooltip
                  key={weekday.key}
                  label={here.map(({ booking }) => (
                    <div key={booking.id}>
                      {formatSlotTime(booking, timeZone)} · {booking.name}
                    </div>
                  ))}
                >
                  {cell}
                </Tooltip>
              ) : (
                cell
              )
            })}
          </div>
        ))}
      </Box>
      <Group gap="md" mt="sm">
        <Group gap={4}>
          <Box w={10} h={10} bg="teal.5" />
          <Text size="xs">бронирование</Text>
        </Group>
        <Group gap={4}>
          <Box w={10} h={10} bg="orange.5" />
          <Text size="xs">бронирование вне доступного времени</Text>
        </Group>
      </Group>
    </Paper>
  )
}
