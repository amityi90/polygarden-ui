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
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
