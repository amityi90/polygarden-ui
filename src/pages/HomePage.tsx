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

      {/* CTA */}
      <Link
        to="/planner"
        className="mt-4 inline-flex items-center gap-3 px-10 py-4 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] transition-all duration-200 shadow-[0_0_28px_rgba(201,168,76,0.25)] hover:shadow-[0_0_40px_rgba(201,168,76,0.4)] no-underline"
      >
        {t('nav.planner')}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* Decorative field grid */}
      <div className="mt-12 w-full max-w-md h-32 rounded-xl border border-white/8 overflow-hidden relative">
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
