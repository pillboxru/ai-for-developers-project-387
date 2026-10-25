import { Anchor, Group, Text, ThemeIcon } from '@mantine/core'
import { IconCalendarTime } from '@tabler/icons-react'
import { Link } from 'react-router'

export function Logo() {
  return (
    <Anchor component={Link} to="/" underline="never" c="inherit">
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon variant="light" size={32}>
          <IconCalendarTime size={20} />
        </ThemeIcon>
        <Text fw={700}>Календарь звонков</Text>
      </Group>
    </Anchor>
  )
}
