import { Box, Divider, Flex, Paper } from '@mantine/core'
import type { ReactNode } from 'react'

interface BookingCardProps {
  // Левая колонка: тип события и владелец
  aside: ReactNode
  // Остальная часть карточки: календарь со слотами, пустое состояние или форма
  children: ReactNode
}

// Одна карточка на весь путь гостя по типу события: левая колонка остаётся,
// меняется только правая часть
export function BookingCard({ aside, children }: BookingCardProps) {
  return (
    <Paper withBorder radius="lg" shadow="sm">
      <Flex direction={{ base: 'column', md: 'row' }}>
        <Box p="lg" w={{ md: 280 }} style={{ flexShrink: 0 }}>
          {aside}
        </Box>
        <Divider orientation="vertical" visibleFrom="md" />
        <Box style={{ flex: 1 }}>{children}</Box>
      </Flex>
    </Paper>
  )
}
