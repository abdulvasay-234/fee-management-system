import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AccessDeniedScreen, AuthLoadingScreen, LoginScreen } from './auth/AuthScreen'
import { useAuth } from './auth/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import { WorkflowProvider } from './features/workflow/WorkflowProvider'
import { CourseCodesPage } from './pages/CourseCodesPage'
import { DashboardPage } from './pages/DashboardPage'
import { FeeReceiptPage } from './pages/FeeReceiptPage'
import { NewAdmissionPage } from './pages/NewAdmissionPage'
import { PaymentHistoryPage } from './pages/PaymentHistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'
import { WalkInsPage } from './pages/WalkInsPage'

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
            <Route path="walk-ins" element={<WalkInsPage />} />
            <Route path="payment-history" element={<PaymentHistoryPage />} />
            <Route path="course-codes" element={<CourseCodesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkflowProvider>
    </HashRouter>
  )
}

export default App
