import { AppShell } from '@mantine/core'
import { Suspense, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { PageErrorBoundary } from './PageErrorBoundary.tsx'
import { PageLoader } from './PageLoader.tsx'

interface PageLayoutProps {
  header: ReactNode
}

// Шапка вне ErrorBoundary: при сбое страницы по ней можно уйти в другой раздел.
// Suspense внутри ErrorBoundary: сбой загрузки чанка страницы показывается как
// сбой страницы, а не роняет всё приложение
export function PageLayout({ header }: PageLayoutProps) {
  return (
    <AppShell header={{ height: 60 }}>
      <AppShell.Header>{header}</AppShell.Header>
      <AppShell.Main>
        <PageErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </AppShell.Main>
    </AppShell>
  )
}
