import {
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core'
import { IconCalendarOff, IconClockHour4 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { eventTypesQuery } from '../api/eventTypes.ts'
import type { PublicEventType } from '../api/generated/types.gen.ts'
import { PageEmptyState } from '../components/PageEmptyState.tsx'
import { QueryContent } from '../components/QueryContent.tsx'
import { formatDuration } from '../format/duration.ts'

function EventTypeCard({ eventType }: { eventType: PublicEventType }) {
  return (
    <Card
      component={Link}
      to={`/book/${eventType.id}`}
      withBorder
      shadow="sm"
      padding="lg"
    >
      <Title order={2} size="h4">
        {eventType.title}
      </Title>
      {eventType.description && (
        // Описание — простой текст: переносы строк владельца сохраняются,
        // разметку не разбираем, чтобы показать ровно то, что он написал
        <Text c="dimmed" mt="xs" style={{ whiteSpace: 'pre-line' }}>
          {eventType.description}
        </Text>
      )}
      <Group mt="md">
        <Badge
          variant="light"
          leftSection={<IconClockHour4 size={14} />}
          tt="none"
        >
          {formatDuration(eventType.durationMinutes)}
        </Badge>
      </Group>
    </Card>
  )
}

export function BookPage() {
  const query = useQuery(eventTypesQuery())

  return (
    <Container size="lg" py="xl">
      <Title order={1}>Запись на звонок</Title>
      <Text c="dimmed" mt="sm">
        Выберите тип события.
      </Text>
      <QueryContent query={query}>
        {(eventTypes) =>
          eventTypes.length === 0 ? (
            <PageEmptyState
              icon={IconCalendarOff}
              title="Пока не на что записаться"
              description="Владелец ещё не открыл запись. Загляните позже."
            />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mt="lg">
              {eventTypes.map((eventType) => (
                <EventTypeCard key={eventType.id} eventType={eventType} />
              ))}
            </SimpleGrid>
          )
        }
      </QueryContent>
    </Container>
  )
}
