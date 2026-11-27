import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AccessDeniedScreen, AuthLoadingScreen, LoginScreen } from './auth/AuthScreen'
import { useAuth } from './auth/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import { WorkflowProvider } from './features/workflow/WorkflowProvider'
import { CourseCodesPage } from './pages/CourseCodesPage'
import { DashboardPage } from './pages/DashboardPage'
import { EnquiriesPage } from './pages/EnquiriesPage'
import { FeeReceiptPage } from './pages/FeeReceiptPage'
import { NewAdmissionPage } from './pages/NewAdmissionPage'
import { PaymentHistoryPage } from './pages/PaymentHistoryPage'
import { StudentsPage } from './pages/StudentsPage'
import { WalkInsPage } from './pages/WalkInsPage'

const AnnouncementsPage = lazy(() => import('./features/announcements/AnnouncementsPage').then((module) => ({ default: module.AnnouncementsPage })))

function App() {
  const { status } = useAuth()

  if (status === 'loading') return <AuthLoadingScreen />
  if (status === 'accessDenied') return <AccessDeniedScreen />
  if (status !== 'authenticated') return <LoginScreen />

  return (
    <HashRouter>
      <WorkflowProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="new-admission" element={<NewAdmissionPage />} />
            <Route path="fee-receipt" element={<FeeReceiptPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="admissions" element={<StudentsPage />} />
            <Route path="enquiries" element={<EnquiriesPage />} />
            <Route path="announcements" element={<Suspense fallback={<p role="status">Loading announcements...</p>}><AnnouncementsPage /></Suspense>} />
            <Route path="walk-ins" element={<WalkInsPage />} />
            <Route path="payment-history" element={<PaymentHistoryPage />} />
            <Route path="course-codes" element={<CourseCodesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkflowProvider>
    </HashRouter>
  )
}

export default App
