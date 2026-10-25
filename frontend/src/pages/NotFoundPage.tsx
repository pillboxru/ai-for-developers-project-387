import { Button, Container } from '@mantine/core'
import { IconError404 } from '@tabler/icons-react'
import { Link } from 'react-router'
import { PageEmptyState } from '../components/PageEmptyState.tsx'

export function NotFoundPage() {
  return (
    <Container size="lg" py="xl">
      <PageEmptyState
        icon={IconError404}
        title="Страница не найдена"
        description="Такого адреса нет. Проверьте ссылку или начните с главной."
        action={
          <Button component={Link} to="/">
            На главную
          </Button>
        }
      />
    </Container>
  )
}
