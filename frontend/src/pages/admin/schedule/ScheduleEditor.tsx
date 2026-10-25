import { Alert, Button, Grid, Group, Modal, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { invalidateBookings } from '../../../api/bookings.ts'
import { isApiError } from '../../../api/errors.ts'
import type { Booking, Schedule } from '../../../api/generated/types.gen.ts'
import {
  setSchedule,
  updateScheduleMutationOptions,
} from '../../../api/schedule.ts'
import { notifyActionError, notifySuccess } from '../../../notifications.ts'
import {
  draftFromSchedule,
  sameDraft,
  toUpdateSchedule,
} from './scheduleDraft.ts'
import { bookingMarks, outsideBookings } from './bookingMarks.ts'
import { ConflictingBookings } from './ConflictingBookings.tsx'
import { OverridesColumn } from './OverridesColumn.tsx'
import { WeekMatrix } from './WeekMatrix.tsx'

interface ScheduleEditorProps {
  schedule: Schedule
  bookings: Booking[]
  timeZone: string
}

// Правки матрицы и исключений копятся в черновике и уходят одним запросом:
// одна пара «Отменить / Сохранить» на страницу (32.1)
export function ScheduleEditor({
  schedule,
  bookings,
  timeZone,
}: ScheduleEditorProps) {
  const queryClient = useQueryClient()
  const saved = draftFromSchedule(schedule)
  const [draft, setDraft] = useState(saved)
  const dirty = !sameDraft(draft, saved)
  const save = useMutation(updateScheduleMutationOptions())
  // Политика «запретить»: с бронированием вне доступного времени черновик
  // не сохраняется, пока владелец не вернёт время или не отменит бронирование
  const conflicts = outsideBookings(draft, bookings, timeZone)
  // Список в модалке «Сохранить нельзя»; null — модалка закрыта
  const [blocked, setBlocked] = useState<Booking[] | null>(null)

  const submit = () => {
    if (conflicts.length > 0) {
      setBlocked(conflicts)
      return
    }
    save.mutate(
      { body: toUpdateSchedule(draft) },
      {
        onSuccess: (next) => {
          setSchedule(queryClient, next)
          setDraft(draftFromSchedule(next))
          notifySuccess('Расписание сохранено')
        },
        // Черновик не трогаем: владелец повторит сохранение без новых правок
        onError: (error) => {
          // Сервер знает бронирования, которых ещё нет на экране
          if (
            isApiError(error) &&
            error.code === 'schedule_conflicts_with_bookings' &&
            error.bookings
          ) {
            setBlocked(error.bookings)
            void invalidateBookings(queryClient)
            return
          }
          notifyActionError()
        },
      },
    )
  }

  return (
    <>
      <Group justify="flex-end" mt="md">
        {dirty && (
          <Text size="sm" c="dimmed">
            Есть несохранённые изменения
          </Text>
        )}
        <Button
          variant="default"
          disabled={!dirty || save.isPending}
          onClick={() => setDraft(saved)}
        >
          Отменить
        </Button>
        <Button disabled={!dirty} loading={save.isPending} onClick={submit}>
          Сохранить
        </Button>
      </Group>
      {conflicts.length > 0 && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle />}
          mt="md"
          title="Так сохранить нельзя: бронирования окажутся вне доступного времени"
        >
          <ConflictingBookings bookings={conflicts} timeZone={timeZone} />
        </Alert>
      )}
      <Grid gap="xl" mt="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <WeekMatrix
            weekly={draft.weekly}
            onChange={(weekly) => setDraft({ ...draft, weekly })}
            marks={bookingMarks(
              draft,
              bookings,
              schedule.bookingWindow,
              timeZone,
            )}
            timeZone={timeZone}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <OverridesColumn
            overrides={draft.overrides}
            onChange={(overrides) => setDraft({ ...draft, overrides })}
            bookingWindow={schedule.bookingWindow}
            conflicts={conflicts}
            timeZone={timeZone}
          />
        </Grid.Col>
      </Grid>
      <Modal
        opened={blocked !== null}
        onClose={() => setBlocked(null)}
        title="Сохранить нельзя"
      >
        <Text size="sm" mb="sm">
          Эти бронирования окажутся вне доступного времени. Сначала отмените их
          или оставьте для них время.
        </Text>
        {blocked && (
          <ConflictingBookings bookings={blocked} timeZone={timeZone} />
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setBlocked(null)}>
            Понятно
          </Button>
        </Group>
      </Modal>
    </>
  )
}
