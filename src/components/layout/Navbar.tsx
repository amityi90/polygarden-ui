/**
 * Navbar — top navigation with language switcher.
 *
 * The language switcher calls `i18n.changeLanguage()` directly. react-i18next
 * re-renders every component that uses `useTranslation()` automatically —
 * no prop drilling, no context wrangling.
 */

import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

export function Navbar() {
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const toggleLanguage = () => {
    const next = i18n.language.startsWith('de') ? 'en' : 'de'
    void i18n.changeLanguage(next)
  }

  const isActive = (path: string) =>
    location.pathname === path

  return (
    <nav className="w-full border-b border-white/8 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <div className="w-8 h-8 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 flex items-center justify-center">
            <span className="text-[#c9a84c] text-sm">✦</span>
          </div>
          <span className="font-['Cormorant_Garant'] text-xl font-semibold text-[#f0ece3] tracking-wide group-hover:text-[#c9a84c] transition-colors">
            PolyGarden
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: t('nav.home'), to: '/' },
            { label: t('nav.planner'), to: '/planner' },
            { label: t('nav.about'), to: '/about' },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className={[
                'text-sm font-medium tracking-wide transition-colors no-underline',
                isActive(to)
                  ? 'text-[#c9a84c]'
                  : 'text-[#9a9080] hover:text-[#f0ece3]',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Language switcher */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 text-[#9a9080] hover:text-[#c9a84c] hover:border-[#c9a84c]/40 transition-all text-sm font-medium tracking-widest cursor-pointer bg-transparent"
          aria-label="Switch language"
        >
          {i18n.language.startsWith('de') ? 'EN' : 'DE'}
        </button>
      </div>
    </nav>
  )
}
