import { Navigate, Route, Routes } from 'react-router'
import { AdminHeader } from './components/AdminHeader.tsx'
import { AppHeader } from './components/AppHeader.tsx'
import { PageLayout } from './components/PageLayout.tsx'
import { BookingsPage } from './pages/admin/BookingsPage.tsx'
import { EventTypesPage } from './pages/admin/EventTypesPage.tsx'
import { SchedulePage } from './pages/admin/SchedulePage.tsx'
import { BookPage } from './pages/BookPage.tsx'
import { EventTypePage } from './pages/EventTypePage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'

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
