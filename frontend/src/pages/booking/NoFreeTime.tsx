import { Box, Button } from '@mantine/core'
import { IconCalendarOff } from '@tabler/icons-react'
import { Link } from 'react-router'
import { PageEmptyState } from '../../components/PageEmptyState.tsx'

// Вместо календаря и слотов, когда в окне записи нет ни одного слота
export function NoFreeTime() {
  return (
    <Box p="lg">
      <PageEmptyState
        icon={IconCalendarOff}
        title="В ближайшие 14 дней свободного времени нет"
        description="Владелец пока не открыл время для этого звонка."
        action={
          <Button component={Link} to="/book">
            Выбрать другой тип события
          </Button>
        }
      />
    </Box>
  )
}
