import { Button, Container } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useLocation } from 'react-router'
import { PageEmptyState } from './PageEmptyState.tsx'

interface PageErrorBoundaryProps {
  children: ReactNode
}

function RenderFailure() {
  return (
    <Container size="lg" py="xl">
      <PageEmptyState
        icon={IconAlertTriangle}
        title="Что-то пошло не так"
        description="Страница не смогла отобразиться."
        action={
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </Button>
        }
      />
    </Container>
  )
}

// Сбой рендера заменяет только содержимое страницы. Сброс по адресу: после
// перехода в другой раздел страница рисуется заново, а не остаётся ошибкой
export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  const { pathname } = useLocation()

  return (
    <ErrorBoundary FallbackComponent={RenderFailure} resetKeys={[pathname]}>
      {children}
    </ErrorBoundary>
  )
}
