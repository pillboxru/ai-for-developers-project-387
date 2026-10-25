import {
  ActionIcon,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  // При схеме 'auto' переключаем от той темы, что реально видна сейчас
  const computedColorScheme = useComputedColorScheme('light')
  const next = computedColorScheme === 'light' ? 'dark' : 'light'

  return (
    <ActionIcon
      variant="default"
      size="lg"
      onClick={() => setColorScheme(next)}
      aria-label={
        next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'
      }
    >
      {next === 'dark' ? <IconMoon size={20} /> : <IconSun size={20} />}
    </ActionIcon>
  )
}
