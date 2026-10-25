import { Button } from '@mantine/core'
import { IconCalendarQuestion } from '@tabler/icons-react'
import { Link } from 'react-router'
import { PageEmptyState } from './PageEmptyState.tsx'

// Скрытый и несуществующий тип гость видит одинаково: и по прямой ссылке,
// и когда тип скрыли, пока он заполнял форму бронирования
export function EventTypeNotFound() {
  return (
    <PageEmptyState
      icon={IconCalendarQuestion}
      title="Тип события не найден"
      description="Возможно, владелец его скрыл или ссылка устарела. Выберите другой тип события."
      action={
        <Button component={Link} to="/book">
          К списку типов событий
        </Button>
      }
    />
  )
}
