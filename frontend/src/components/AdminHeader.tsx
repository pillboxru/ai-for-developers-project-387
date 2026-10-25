import {
  Burger,
  Button,
  Container,
  Drawer,
  Group,
  NavLink,
  Stack,
  Tabs,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconArrowRight } from '@tabler/icons-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ColorSchemeToggle } from './ColorSchemeToggle.tsx'
import { Logo } from './Logo.tsx'

const sections = [
  { path: '/admin/bookings', label: 'Бронирования' },
  { path: '/admin/event-types', label: 'Типы событий' },
  { path: '/admin/schedule', label: 'Расписание' },
]

export function AdminHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpened, menu] = useDisclosure(false)
  const current =
    sections.find(({ path }) => pathname.startsWith(path))?.path ?? null

  return (
    <Container size="lg" h="100%">
      <Group h="100%" justify="space-between" wrap="nowrap">
        <Group gap="xl" wrap="nowrap">
          <Logo />
          {/* Вкладки только переключают адрес: содержимое раздела
              рисует маршрут, а не Tabs.Panel */}
          <Tabs
            value={current}
            onChange={(path) => path && navigate(path)}
            variant="pills"
            visibleFrom="sm"
          >
            <Tabs.List>
              {sections.map(({ path, label }) => (
                <Tabs.Tab key={path} value={path}>
                  {label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            component={Link}
            to="/book"
            variant="subtle"
            rightSection={<IconArrowRight size={16} />}
            visibleFrom="sm"
          >
            К записи
          </Button>
          <ColorSchemeToggle />
          <Burger
            opened={menuOpened}
            onClick={menu.toggle}
            hiddenFrom="sm"
            aria-label={menuOpened ? 'Закрыть меню' : 'Открыть меню'}
          />
        </Group>
      </Group>

      <Drawer
        opened={menuOpened}
        onClose={menu.close}
        title="Разделы"
        position="right"
        hiddenFrom="sm"
        size="xs"
      >
        <Stack gap={4}>
          {sections.map(({ path, label }) => (
            <NavLink
              key={path}
              component={Link}
              to={path}
              label={label}
              active={path === current}
              onClick={menu.close}
            />
          ))}
          <NavLink
            component={Link}
            to="/book"
            label="К записи"
            rightSection={<IconArrowRight size={16} />}
            onClick={menu.close}
          />
        </Stack>
      </Drawer>
    </Container>
  )
}
