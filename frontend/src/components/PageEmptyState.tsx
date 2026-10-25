import { EmptyState } from '@mantine/core'
import type { TablerIcon } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface PageEmptyStateProps {
  icon: TablerIcon
  title: string
  description: string
  // Например, кнопка «Создать тип события»
  action?: ReactNode
}

// Одинаковое пустое состояние для всех экранов: на месте списка, когда в нём
// ничего нет
export function PageEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: PageEmptyStateProps) {
  return (
    <EmptyState variant="light" py="xl">
      <EmptyState.Indicator>
        <Icon />
      </EmptyState.Indicator>
      <EmptyState.Title order={2}>{title}</EmptyState.Title>
      <EmptyState.Description>{description}</EmptyState.Description>
      {action && <EmptyState.Actions>{action}</EmptyState.Actions>}
    </EmptyState>
  )
}
