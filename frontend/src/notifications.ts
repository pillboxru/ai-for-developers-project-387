import { notifications } from '@mantine/notifications'

export function notifySuccess(message: string) {
  notifications.show({ color: 'green', message })
}

// Действие не удалось из-за сети, 5xx или неожиданного 4xx. Форма остаётся
// как была, чтобы пользователь повторил без повторного ввода
export function notifyActionError(
  message = 'Не удалось сохранить. Попробуйте ещё раз.',
) {
  notifications.show({ color: 'red', message })
}
