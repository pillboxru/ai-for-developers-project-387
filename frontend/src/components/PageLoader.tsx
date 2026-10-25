import { Center, Loader } from '@mantine/core'

// По центру области страницы: шапка остаётся на месте
export function PageLoader() {
  return (
    <Center mih="50vh">
      <Loader role="status" aria-label="Загрузка" />
    </Center>
  )
}
