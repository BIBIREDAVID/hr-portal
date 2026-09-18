import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireRole from './components/RequireRole'
import DashboardLayout from './components/DashboardLayout'
import Login from './pages/login'
import DashboardHome from './pages/dashboard'
import JobsList from './pages/dashboard/jobs/JobsList'
import JobForm from './pages/dashboard/jobs/JobForm'
import ApplyPage from './pages/apply/ApplyPage'
import JobsBoard from './pages/apply/JobsBoard'
import StatusPage from './pages/status/StatusPage'
import StatusLookupPage from './pages/status/StatusLookupPage'
import PrivacyPage from './pages/PrivacyPage'
import ApplicationsList from './pages/dashboard/applications/ApplicationsList'
import ApplicationRedirect from './pages/dashboard/applications/ApplicationRedirect'
import CandidateDetail from './pages/dashboard/candidates/CandidateDetail'
import ManualUpload from './pages/dashboard/candidates/ManualUpload'
import InterviewsOverview from './pages/dashboard/interviews/InterviewsOverview'
import EmailTriggersSettings from './pages/dashboard/settings/EmailTriggersSettings'
import StaffSettings from './pages/dashboard/settings/StaffSettings'
import ReportsPage from './pages/dashboard/reports/ReportsPage'
import ComparePage from './pages/dashboard/applications/ComparePage'
import CalendarPage from './pages/dashboard/calendar/CalendarPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/apply" element={<JobsBoard />} />
          <Route path="/apply/:jobId" element={<ApplyPage />} />
          <Route path="/status" element={<StatusLookupPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/status/:token" element={<StatusPage />} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardHome />} />

            <Route
              path="jobs"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <JobsList />
                </RequireRole>
              }
            />
            <Route
              path="jobs/new"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <JobForm mode="create" />
                </RequireRole>
              }
            />
            <Route
              path="jobs/:id"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <JobForm mode="edit" />
                </RequireRole>
              }
            />

            <Route path="applications" element={<ApplicationsList />} />
            <Route
              path="applications/compare"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <ComparePage />
                </RequireRole>
              }
            />
            <Route path="applications/:id" element={<ApplicationRedirect />} />
            <Route path="candidates/:id" element={<CandidateDetail />} />
            <Route
              path="candidates/new"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <ManualUpload />
                </RequireRole>
              }
            />

            <Route path="interviews" element={<InterviewsOverview />} />
            <Route path="calendar" element={<CalendarPage />} />

            <Route
              path="reports"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <ReportsPage />
                </RequireRole>
              }
            />

            <Route
              path="settings/email-triggers"
              element={
                <RequireRole roles={['admin', 'recruiter']}>
                  <EmailTriggersSettings />
                </RequireRole>
              }
            />
            <Route
              path="settings/staff"
              element={
                <RequireRole roles={['admin']}>
                  <StaffSettings />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
