/**
 * Navbar — top navigation with language switcher.
 *
 * The language switcher calls `i18n.changeLanguage()` directly. react-i18next
 * re-renders every component that uses `useTranslation()` automatically —
 * no prop drilling, no context wrangling.
 */

import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export function Navbar() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleLanguage = () => {
    const next = i18n.language.startsWith('de') ? 'en' : 'de'
    void i18n.changeLanguage(next)
  }

  const isActive = (path: string) =>
    location.pathname === path

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuOpen])

  const navLinks = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.planner'), to: '/planner' },
    { label: t('nav.about'), to: '/about' },
  ]

  return (
    <nav className="w-full border-b border-white/8 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 cursor-pointer bg-transparent border-none p-0"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-[2px] bg-[#f0ece3] transition-all duration-200 ${menuOpen ? 'translate-y-[7px] rotate-45' : ''}`} />
          <span className={`block w-5 h-[2px] bg-[#f0ece3] transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-[2px] bg-[#f0ece3] transition-all duration-200 ${menuOpen ? '-translate-y-[7px] -rotate-45' : ''}`} />
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <div className="w-8 h-8 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 flex items-center justify-center">
            <span className="text-[#c9a84c] text-sm">✦</span>
          </div>
          <span className="font-['Cormorant_Garant'] text-xl font-semibold text-[#f0ece3] tracking-wide group-hover:text-[#c9a84c] transition-colors">
            PolyGarden
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ label, to }) => (
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

      {/* Mobile slide menu */}
      <div
        ref={menuRef}
        className={[
          'md:hidden fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-[#0a0a0a]/95 backdrop-blur-md border-r border-white/8',
          'flex flex-col gap-2 px-6 py-6 transition-transform duration-250 z-40',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {navLinks.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className={[
              'text-sm font-medium tracking-wide py-3 border-b border-white/5 no-underline transition-colors',
              isActive(to)
                ? 'text-[#c9a84c]'
                : 'text-[#9a9080] hover:text-[#f0ece3]',
            ].join(' ')}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
