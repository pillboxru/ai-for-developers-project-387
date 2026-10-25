import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowRight,
  IconClockHour4,
  IconShieldCheck,
  IconUserCheck,
  type TablerIcon,
} from '@tabler/icons-react'
import { Link } from 'react-router'

interface Feature {
  icon: TablerIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: IconClockHour4,
    title: 'Звонки разной длительности',
    description: 'Длительность задаёт тип события, время открывает владелец.',
  },
  {
    icon: IconShieldCheck,
    title: 'Без накладок',
    description: 'Занятое время никому не предложат повторно.',
  },
  {
    icon: IconUserCheck,
    title: 'Без регистрации',
    description: 'Выберите слот и укажите, как с вами связаться.',
  },
]

interface Step {
  title: string
  description: string
}

const steps: Step[] = [
  {
    title: 'Выберите тип события',
    description: 'У каждого типа своё название и длительность.',
  },
  {
    title: 'Выберите слот',
    description: 'В календаре видны свободные слоты на 14 дней вперёд.',
  },
  {
    title: 'Оставьте имя и email',
    description: 'Владелец пришлёт ссылку на звонок на ваш email.',
  },
]

const accentGradient = { from: 'indigo', to: 'cyan', deg: 90 }

export function HomePage() {
  return (
    <Container size="lg" py={{ base: 48, sm: 96 }}>
      <Stack align="center" ta="center" gap="lg">
        <Badge variant="light" size="lg" radius="xl">
          Быстрая запись на звонок
        </Badge>
        <Title order={1} fz={{ base: 40, sm: 64 }} lh={1.1}>
          Календарь{' '}
          <Text span inherit variant="gradient" gradient={accentGradient}>
            звонков
          </Text>
        </Title>
        <Text c="dimmed" size="xl" maw={560}>
          Выберите свободный слот у владельца и запишитесь на звонок. Без
          регистрации и лишних шагов.
        </Text>
        <Group justify="center" mt="md">
          <Button
            component={Link}
            to="/book"
            size="lg"
            variant="gradient"
            gradient={accentGradient}
            rightSection={<IconArrowRight size={20} />}
          >
            Записаться
          </Button>
          <Button
            component="a"
            href="#how-it-works"
            size="lg"
            variant="default"
          >
            Как это работает
          </Button>
        </Group>
      </Stack>

      <SimpleGrid
        cols={{ base: 1, sm: 3 }}
        spacing="lg"
        mt={{ base: 64, sm: 96 }}
      >
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} withBorder shadow="sm" padding="xl">
            <ThemeIcon variant="light" size={48}>
              <Icon size={26} />
            </ThemeIcon>
            <Text fw={600} size="lg" mt="md">
              {title}
            </Text>
            <Text c="dimmed" mt={4}>
              {description}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Stack
        component="section"
        id="how-it-works"
        aria-labelledby="how-it-works-title"
        gap="xl"
        mt={{ base: 64, sm: 96 }}
      >
        <Title order={2} ta="center" id="how-it-works-title">
          Как это работает
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {steps.map(({ title, description }, index) => (
            <Stack key={title} align="center" ta="center" gap="xs">
              <ThemeIcon variant="light" size={44} radius="xl">
                <Text fw={700}>{index + 1}</Text>
              </ThemeIcon>
              <Text fw={600} size="lg">
                {title}
              </Text>
              <Text c="dimmed">{description}</Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  )
}
