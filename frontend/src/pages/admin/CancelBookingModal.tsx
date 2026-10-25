import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  cancelBookingMutationOptions,
  invalidateBookings,
} from '../../api/bookings.ts'
import { isApiError } from '../../api/errors.ts'
import type { Booking } from '../../api/generated/types.gen.ts'
import { invalidateSlots } from '../../api/slots.ts'
import { formatSlotTime } from '../../format/dateTime.ts'
import { notifyActionError, notifySuccess } from '../../notifications.ts'

// Пока модалка была открыта, звонок закончился или бронирование пропало:
// отменять уже нечего, список устарел
const goneMessages: Record<'booking_ended' | 'not_found', string> = {
  booking_ended: 'Бронирование уже закончилось',
  not_found: 'Бронирование не найдено',
}

interface CancelBookingModalProps {
  opened: boolean
  onClose: () => void
  booking: Booking
  ownerTimeZone: string
}

// Отмену не вернуть, поэтому сначала подтверждение (28.1). Причину не
// спрашиваем: владелец сам напишет гостю
export function CancelBookingModal({
  opened,
  onClose,
  booking,
  ownerTimeZone,
}: CancelBookingModalProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    ...cancelBookingMutationOptions(),
    onSuccess: async () => {
      notifySuccess('Бронирование отменено')
      onClose()
      // Время снова свободно: слоты типа перечитаются, если они в кеше
      await Promise.all([
        invalidateBookings(queryClient),
        invalidateSlots(queryClient, booking.eventType.id),
      ])
    },
    onError: async (error) => {
      if (
        isApiError(error) &&
        (error.code === 'booking_ended' || error.code === 'not_found')
      ) {
        notifyActionError(goneMessages[error.code])
        onClose()
        await invalidateBookings(queryClient)
        return
      }
      notifyActionError('Не удалось отменить бронирование. Попробуйте ещё раз.')
    },
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Отменить бронирование?">
      <Stack>
        <Text>
          {booking.eventType.title}, {formatSlotTime(booking, ownerTimeZone)}
        </Text>
        <Text>
          Гость: {booking.name}, {booking.email}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Не отменять
          </Button>
          <Button
            color="red"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ path: { bookingId: booking.id } })}
          >
            Отменить бронирование
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
