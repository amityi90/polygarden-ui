import { useTranslation } from 'react-i18next'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="w-full border-t border-white/8 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo + tagline */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 flex items-center justify-center">
            <span className="text-[#c9a84c] text-xs">✦</span>
          </div>
          <span className="font-['Cormorant_Garant'] text-lg font-medium text-[#9a9080]">
            {t('footer.tagline')}
          </span>
        </div>

        {/* Rights */}
        <p className="text-xs text-[#5a5248] tracking-wide">
          {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}
