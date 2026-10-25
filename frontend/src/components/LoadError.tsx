import { Alert, Button } from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'

interface LoadErrorProps {
  onRetry: () => void
}

export function LoadError({ onRetry }: LoadErrorProps) {
  return (
    <Alert
      color="red"
      icon={<IconAlertCircle />}
      title="Не удалось загрузить данные. Проверьте подключение и попробуйте ещё раз."
    >
      <Button
        mt="xs"
        color="red"
        variant="light"
        leftSection={<IconRefresh size={16} />}
        onClick={onRetry}
      >
        Повторить
      </Button>
    </Alert>
  )
}
