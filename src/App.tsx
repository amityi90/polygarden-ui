/**
 * App.tsx — root component.
 *
 * Why React Router?
 * ─────────────────
 * We have multiple distinct "screens": the homepage, the wizard, and the
 * summary. React Router v6 maps URL paths to components, so the back button
 * works and users can share a link directly to the planner. Each <Route>
 * wraps its component in our Layout (Navbar + Footer).
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/HomePage'
import { WizardPage } from './pages/WizardPage'
import { GardenWizardPage } from './pages/GardenWizardPage'
import { SummaryPage } from './pages/SummaryPage'
import { AboutPage } from './pages/AboutPage'
import { DashboardPage } from './pages/DashboardPage'
import { GardenDocsPage } from './pages/GardenDocsPage'
import { SavedLayoutPage } from './pages/SavedLayoutPage'
import { RequireAuth } from './components/auth/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"        element={<HomePage />} />
          <Route path="/planner" element={<WizardPage />} />
          <Route path="/garden"  element={<GardenWizardPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/about"   element={<AboutPage />} />
          <Route path="/dashboard"            element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/dashboard/:id/view"   element={<RequireAuth><SavedLayoutPage /></RequireAuth>} />
          <Route path="/dashboard/:id/docs"   element={<RequireAuth><GardenDocsPage /></RequireAuth>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
