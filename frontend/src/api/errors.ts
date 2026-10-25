import type { ApiError, ErrorCode } from './generated/types.gen.ts'

const errorCodes: Record<ErrorCode, true> = {
  validation_error: true,
  not_found: true,
  slot_unavailable: true,
  event_type_title_taken: true,
  event_type_has_bookings: true,
  schedule_conflicts_with_bookings: true,
  booking_ended: true,
  internal_error: true,
}

// Клиент бросает тело ответа: при ошибке API это ApiError, при сбое сети —
// TypeError из fetch, при ответе не от нашего сервера — текст или что угодно
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code in errorCodes &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

// Ошибки полей в виде, который принимает form.setErrors из @mantine/form:
// пути через точки у сервера и у формы совпадают. null — ошибка не про поля
export function fieldErrorsOf(error: unknown): Record<string, string> | null {
  if (!isApiError(error) || !error.fieldErrors?.length) {
    return null
  }
  return Object.fromEntries(
    error.fieldErrors.map(({ field, message }) => [field, message]),
  )
}
