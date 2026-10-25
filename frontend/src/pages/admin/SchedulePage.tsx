import { Container, Group, Text, Title } from '@mantine/core'
import { IconWorld } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { bookingsQuery } from '../../api/bookings.ts'
import { ownerQuery } from '../../api/owner.ts'
import { scheduleQuery } from '../../api/schedule.ts'
import { QueryContent } from '../../components/QueryContent.tsx'
import { ScheduleEditor } from './schedule/ScheduleEditor.tsx'

export function SchedulePage() {
  const owner = useQuery(ownerQuery())
  const schedule = useQuery(scheduleQuery())
  const bookings = useQuery(bookingsQuery())

  return (
    <Container size="lg" py="xl">
      <Title order={1}>Расписание</Title>
      <QueryContent query={owner}>
        {({ timeZone }) => (
          <>
            <Group gap={6} mt="xs" wrap="nowrap">
              <IconWorld size={16} />
              <Text size="sm" c="dimmed">
                Время по поясу владельца: {timeZone}
              </Text>
            </Group>
            <QueryContent query={schedule}>
              {(savedSchedule) => (
                <QueryContent query={bookings}>
                  {(upcoming) => (
                    <ScheduleEditor
                      schedule={savedSchedule}
                      bookings={upcoming}
                      timeZone={timeZone}
                    />
                  )}
                </QueryContent>
              )}
            </QueryContent>
          </>
        )}
      </QueryContent>
    </Container>
  )
}
