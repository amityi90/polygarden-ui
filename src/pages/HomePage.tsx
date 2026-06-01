import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-8 max-w-3xl mx-auto">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/8 text-[#c9a84c] text-xs tracking-widest uppercase">
        <span>✦</span>
        <span>Agrivoltaic Field Planner</span>
      </div>

      {/* Headline */}
      <h1 className="font-['Cormorant_Garant'] text-6xl md:text-7xl font-semibold text-[#f0ece3] leading-tight">
        Grow Plants.<br />
        <span className="text-[#c9a84c]">Harvest Sunlight.</span>
      </h1>

      {/* Subline */}
      <p className="text-[#9a9080] text-lg leading-relaxed max-w-xl">
        Design the perfect permaculture field integrated with a photovoltaic system — optimised for companion planting, shadow calculations, and maximum yield.
      </p>

      {/* CTA — twin glass cards */}
      <div className="mt-4 flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
        <PlannerCard
          to="/planner"
          icon="☀"
          title={t('nav.planner')}
          tagline={t('home.field.tagline')}
          accent="#c9a84c"
        />
        <PlannerCard
          to="/garden"
          icon="🌱"
          title={t('nav.garden')}
          tagline={t('home.garden.tagline')}
          accent="#4e8f63"
        />
      </div>

      {/* Decorative field grid */}
      <div className="mt-8 w-full max-w-md h-32 rounded-xl border border-white/8 overflow-hidden relative">
        <div className="absolute inset-0 bg-[#0d0d0d]">
          {/* Rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 rounded-sm"
              style={{
                height: i % 3 === 2 ? '4px' : '10px',
                top: `${8 + i * 19}px`,
                backgroundColor: i % 3 === 2 ? '#1a1a1a' : i % 6 === 0 ? '#c9a84c33' : '#3a6b4a33',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Planner choice card (frosted glass, accent glow on hover) ─────────────────

interface PlannerCardProps {
  to: string
  icon: string
  title: string
  tagline: string
  accent: string
}

function PlannerCard({ to, icon, title, tagline, accent }: PlannerCardProps) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex-1 flex items-center gap-4 rounded-xl border bg-white/[0.03] backdrop-blur-sm px-6 py-5 no-underline text-left transition-all duration-200"
      style={{
        borderColor: hover ? `${accent}80` : 'rgba(255,255,255,0.10)',
        boxShadow: hover ? `0 0 30px ${accent}33` : 'none',
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: `${accent}26`, border: `1px solid ${accent}55` }}
      >
        {icon}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className="font-['Cormorant_Garant'] text-xl font-semibold leading-tight transition-colors"
          style={{ color: hover ? accent : '#f0ece3' }}
        >
          {title}
        </span>
        <span className="text-[#9a9080] text-sm leading-snug">{tagline}</span>
      </div>
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 transition-colors"
        style={{ color: hover ? accent : '#5a5248' }}
      >
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
