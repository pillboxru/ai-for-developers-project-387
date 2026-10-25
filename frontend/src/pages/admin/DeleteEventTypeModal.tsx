import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isApiError } from '../../api/errors.ts'
import {
  deleteEventTypeMutationOptions,
  invalidateEventTypes,
} from '../../api/eventTypes.ts'
import type { EventType } from '../../api/generated/types.gen.ts'
import { notifyActionError, notifySuccess } from '../../notifications.ts'

interface DeleteEventTypeModalProps {
  opened: boolean
  onClose: () => void
  eventType: EventType
}

// Удаление не отменить, поэтому сначала подтверждение (25.1)
export function DeleteEventTypeModal({
  opened,
  onClose,
  eventType,
}: DeleteEventTypeModalProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    ...deleteEventTypeMutationOptions(),
    onSuccess: async () => {
      notifySuccess('Тип события удалён')
      onClose()
      await invalidateEventTypes(queryClient)
    },
    onError: async (error) => {
      if (isApiError(error) && error.code === 'event_type_has_bookings') {
        // Бронирование появилось, пока диалог был открыт
        notifyActionError(error.message)
        onClose()
        await invalidateEventTypes(queryClient)
        return
      }
      notifyActionError('Не удалось удалить тип события. Попробуйте ещё раз.')
    },
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Удалить тип события?">
      <Stack>
        <Text>
          Тип «{eventType.title}» пропадёт у вас и у гостей. Восстановить его не
          получится.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            color="red"
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate({ path: { eventTypeId: eventType.id } })
            }
          >
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
