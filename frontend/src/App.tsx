import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AdminHeader } from './components/AdminHeader.tsx'
import { AppHeader } from './components/AppHeader.tsx'
import { PageLayout } from './components/PageLayout.tsx'
import { HomePage } from './pages/HomePage.tsx'

// Главная грузится сразу, остальные страницы (в том числе админка) — отдельными
// чанками, чтобы гость на телефоне не скачивал код, который не откроет
const BookingsPage = lazy(() =>
  import('./pages/admin/BookingsPage.tsx').then((m) => ({
    default: m.BookingsPage,
  })),
)
const EventTypesPage = lazy(() =>
  import('./pages/admin/EventTypesPage.tsx').then((m) => ({
    default: m.EventTypesPage,
  })),
)
const SchedulePage = lazy(() =>
  import('./pages/admin/SchedulePage.tsx').then((m) => ({
    default: m.SchedulePage,
  })),
)
const BookPage = lazy(() =>
  import('./pages/BookPage.tsx').then((m) => ({ default: m.BookPage })),
)
const EventTypePage = lazy(() =>
  import('./pages/EventTypePage.tsx').then((m) => ({
    default: m.EventTypePage,
  })),
)
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage.tsx').then((m) => ({ default: m.NotFoundPage })),
)

function App() {
  return (
    <Routes>
      <Route element={<PageLayout header={<AppHeader />} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/book" element={<BookPage />} />
        <Route path="/book/:eventTypeId" element={<EventTypePage />} />
        {/* Внутри гостевой шапки: с неизвестного адреса, в том числе под
            /admin, человек скорее гость, чем владелец */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/admin" element={<PageLayout header={<AdminHeader />} />}>
        <Route index element={<Navigate to="/admin/bookings" replace />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="event-types" element={<EventTypesPage />} />
        <Route path="schedule" element={<SchedulePage />} />
      </Route>
    </Routes>
  )
}

export default App
