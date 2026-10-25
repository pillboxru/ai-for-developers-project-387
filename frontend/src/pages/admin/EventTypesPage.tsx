import { Button, Container, Group, Stack, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconCalendarPlus, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminEventTypesQuery } from '../../api/eventTypes.ts'
import type { EventType } from '../../api/generated/types.gen.ts'
import { PageEmptyState } from '../../components/PageEmptyState.tsx'
import { QueryContent } from '../../components/QueryContent.tsx'
import { DeleteEventTypeModal } from './DeleteEventTypeModal.tsx'
import { EventTypeModal } from './EventTypeModal.tsx'
import { EventTypesTable } from './EventTypesTable.tsx'

export function EventTypesPage() {
  const query = useQuery(adminEventTypesQuery())
  const [modalOpened, modal] = useDisclosure(false)
  // Тип, который правится в модалке; undefined — модалка создаёт новый
  const [editing, setEditing] = useState<EventType>()
  // Форма берёт значения при монтировании. Новый key на каждое открытие
  // даёт свежие значения из списка, даже если снова открыт тот же тип
  const [modalKey, setModalKey] = useState(0)

  const openModal = (eventType?: EventType) => {
    setEditing(eventType)
    setModalKey((key) => key + 1)
    modal.open()
  }
  const openCreate = () => openModal()

  const [deleteOpened, deleteModal] = useDisclosure(false)
  // Остаётся заданным и после закрытия: модалка показывает название, пока
  // уходит с экрана
  const [deleting, setDeleting] = useState<EventType>()
  const openDelete = (eventType: EventType) => {
    setDeleting(eventType)
    deleteModal.open()
  }

  const createButton = (
    <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
      Создать тип события
    </Button>
  )

  return (
    <Container size="lg" py="xl">
      <Title order={1}>Типы событий</Title>
      <QueryContent query={query}>
        {(eventTypes) =>
          eventTypes.length === 0 ? (
            <PageEmptyState
              icon={IconCalendarPlus}
              title="Типов событий пока нет"
              description="Создайте первый, чтобы гости могли записаться."
              action={createButton}
            />
          ) : (
            <Stack mt="lg" gap="md">
              <Group>{createButton}</Group>
              <EventTypesTable
                eventTypes={eventTypes}
                onEdit={openModal}
                onDelete={openDelete}
              />
            </Stack>
          )
        }
      </QueryContent>
      <EventTypeModal
        key={modalKey}
        opened={modalOpened}
        onClose={modal.close}
        eventType={editing}
      />
      {deleting && (
        <DeleteEventTypeModal
          opened={deleteOpened}
          onClose={deleteModal.close}
          eventType={deleting}
        />
      )}
    </Container>
  )
}
