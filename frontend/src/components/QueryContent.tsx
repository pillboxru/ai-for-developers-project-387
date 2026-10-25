import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LoadError } from './LoadError.tsx'
import { PageLoader } from './PageLoader.tsx'

interface QueryContentProps<TData> {
  query: UseQueryResult<TData, unknown>
  children: (data: TData) => ReactNode
}

// Общие состояния загрузки экрана. Пока данных нет — Loader, при ошибке —
// Alert с «Повторить». Если данные уже есть, при перезагрузке на экране
// остаются они: Loader и ошибка показываются только вместо пустого места
export function QueryContent<TData>({
  query,
  children,
}: QueryContentProps<TData>) {
  if (query.data !== undefined) {
    return children(query.data)
  }
  if (query.isError) {
    return <LoadError onRetry={() => query.refetch()} />
  }
  return <PageLoader />
}
