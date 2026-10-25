import { Alert, Box, Divider, Flex, Stack } from '@mantine/core'
import { DatePicker, DatesProvider } from '@mantine/dates'
import { IconAlertTriangle } from '@tabler/icons-react'
import 'dayjs/locale/ru'
import type { Slot, SlotList } from '../../api/generated/types.gen.ts'
import { DaySlots } from './DaySlots.tsx'
import { guestDays } from './guestDays.ts'

interface SlotPickerProps {
  slotList: SlotList
  guestTimeZone: string
  // Дата гостя 'YYYY-MM-DD'. Хранится выше: календарь размонтируется на
  // время формы, а гость возвращается к той же дате (12.2, 14.2)
  selectedDate: string | null
  onDateChange: (date: string) => void
  // Выбранное время заняли: гость выбирает заново
  slotUnavailable: boolean
  onCloseSlotUnavailable: () => void
  onSelect: (slot: Slot) => void
}

const calendarLabels = {
  previousMonth: 'Предыдущий месяц',
  nextMonth: 'Следующий месяц',
}

export function SlotPicker({
  slotList,
  guestTimeZone,
  selectedDate,
  onDateChange,
  slotUnavailable,
  onCloseSlotUnavailable,
  onSelect,
}: SlotPickerProps) {
  const { minDate, maxDate, slotsByDate } = guestDays(slotList, guestTimeZone)
  const [firstDate] = slotsByDate.keys()
  // Без выбора и когда на выбранной дате слотов не осталось (их перезагрузили)
  // — первая дата со слотами
  const shownDate =
    selectedDate !== null && slotsByDate.has(selectedDate)
      ? selectedDate
      : firstDate
  const daySlots = slotsByDate.get(shownDate)

  return (
    <DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1 }}>
      <Stack gap={0}>
        {slotUnavailable && (
          <Box px="lg" pt="lg">
            <Alert
              color="yellow"
              icon={<IconAlertTriangle />}
              title="Это время уже недоступно. Выберите другое."
              withCloseButton
              closeButtonLabel="Закрыть"
              onClose={onCloseSlotUnavailable}
            />
          </Box>
        )}
        <Flex direction={{ base: 'column', md: 'row' }}>
          <Box p="lg">
            <DatePicker
              size="md"
              value={shownDate}
              defaultDate={shownDate}
              // Без allowDeselect повторный щелчок не снимает выбор: null не придёт
              onChange={(date) => date && onDateChange(date)}
              minDate={minDate}
              maxDate={maxDate}
              maxLevel="month"
              excludeDate={(date) => !slotsByDate.has(date)}
              ariaLabels={calendarLabels}
              // Mantine отмечает выбранный день только атрибутом data-selected:
              // aria-pressed сообщает выбор и программе чтения с экрана
              getDayProps={(date) => ({ 'aria-pressed': date === shownDate })}
            />
          </Box>
          <Divider orientation="vertical" visibleFrom="md" />
          <Box p="lg" w={{ md: 260 }}>
            {daySlots && (
              <DaySlots
                date={shownDate}
                slots={daySlots}
                guestTimeZone={guestTimeZone}
                onSelect={onSelect}
              />
            )}
          </Box>
        </Flex>
      </Stack>
    </DatesProvider>
  )
}
