import { Button, Group, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { createBookingMutationOptions } from '../../api/bookings.ts'
import { fieldErrorsOf, isApiError } from '../../api/errors.ts'
import type {
  Booking,
  CreateBooking,
  Slot,
} from '../../api/generated/types.gen.ts'
import { notifyActionError } from '../../notifications.ts'
import type { GuestDetails } from './guestDetails.ts'

// Шаблон email из контракта
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Те же правила и тексты, что у сервера, но после обрезки пробелов: так
// их проверит сервер, получив обрезанные строки
const validate = {
  name: (value: string) => {
    const name = value.trim()
    if (name.length === 0) return 'Обязательное поле'
    if (name.length > 100) return 'Не больше 100 символов'
    return null
  },
  email: (value: string) => {
    const email = value.trim()
    if (email.length === 0) return 'Обязательное поле'
    if (email.length > 254) return 'Не больше 254 символов'
    if (!emailPattern.test(email)) return 'Неверный формат'
    return null
  },
  comment: (value: string) =>
    value.trim().length > 1000 ? 'Не больше 1000 символов' : null,
}

// Сервер строки не обрезает: пробелы по краям убирает форма, регистр email
// не меняется, а пустой необязательный комментарий не отправляется
function toRequestBody(slot: Slot, details: GuestDetails): CreateBooking {
  const comment = details.comment.trim()
  return {
    start: slot.start,
    name: details.name.trim(),
    email: details.email.trim(),
    ...(comment && { comment }),
  }
}

interface BookingFormProps {
  eventTypeId: string
  slot: Slot
  guestDetails: GuestDetails
  onGuestDetailsChange: (details: GuestDetails) => void
  onBooked: (booking: Booking) => void
  // Время заняли, пока гость заполнял форму: он выбирает другое (14.2)
  onSlotUnavailable: () => void
  // Тип скрыли или удалили, пока гость заполнял форму (18.1)
  onEventTypeGone: () => void
}

export function BookingForm({
  eventTypeId,
  slot,
  guestDetails,
  onGuestDetailsChange,
  onBooked,
  onSlotUnavailable,
  onEventTypeGone,
}: BookingFormProps) {
  // До первой отправки гость не видит ошибок незаполненной формы, после неё
  // поле проверяется и при уходе с него (13.2)
  const [submitted, setSubmitted] = useState(false)
  const form = useForm({
    initialValues: guestDetails,
    onValuesChange: onGuestDetailsChange,
    validate,
    validateInputOnBlur: submitted,
  })
  const mutation = useMutation({
    ...createBookingMutationOptions(),
    onSuccess: onBooked,
    onError: (error) => {
      if (isApiError(error) && error.code === 'slot_unavailable') {
        return onSlotUnavailable()
      }
      if (isApiError(error) && error.code === 'not_found') {
        return onEventTypeGone()
      }
      const fieldErrors = fieldErrorsOf(error)
      if (fieldErrors) {
        form.setErrors(fieldErrors)
      } else {
        notifyActionError()
      }
    },
  })

  return (
    <form
      noValidate
      onSubmit={form.onSubmit(
        (values) => {
          setSubmitted(true)
          mutation.mutate({
            path: { eventTypeId },
            body: toRequestBody(slot, values),
          })
        },
        () => setSubmitted(true),
      )}
    >
      <Stack p="lg">
        <TextInput
          label="Имя"
          withAsterisk
          autoComplete="name"
          {...form.getInputProps('name')}
        />
        <TextInput
          label="Email"
          withAsterisk
          autoComplete="email"
          inputMode="email"
          {...form.getInputProps('email')}
        />
        <Textarea
          label="Комментарий"
          autosize
          minRows={3}
          {...form.getInputProps('comment')}
        />
        <Group>
          <Button type="submit" loading={mutation.isPending}>
            Забронировать
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
