import { AppShell } from '@mantine/core'
import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import { PageErrorBoundary } from './PageErrorBoundary.tsx'

interface PageLayoutProps {
  header: ReactNode
}

// Шапка вне ErrorBoundary: при сбое страницы по ней можно уйти в другой раздел
export function PageLayout({ header }: PageLayoutProps) {
  return (
    <AppShell header={{ height: 60 }}>
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Main>
        <PageErrorBoundary>
          <Outlet />
        </PageErrorBoundary>
      </AppShell.Main>
    </AppShell>
  )
}
