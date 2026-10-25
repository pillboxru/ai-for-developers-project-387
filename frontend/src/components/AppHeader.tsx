import { Button, Container, Group } from '@mantine/core'
import { Link } from 'react-router'
import { ColorSchemeToggle } from './ColorSchemeToggle.tsx'
import { Logo } from './Logo.tsx'

export function AppHeader() {
  return (
    <Container size="lg" h="100%">
      <Group h="100%" justify="space-between">
        <Logo />
        <Group gap="xs">
          <Button component={Link} to="/book" variant="subtle">
            Записаться
          </Button>
          <Button component={Link} to="/admin" variant="subtle" color="gray">
            Владельцу
          </Button>
          <ColorSchemeToggle />
        </Group>
      </Group>
    </Container>
  )
}
