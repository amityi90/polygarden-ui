import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface LoadingModalProps {
  title: string
  subtitle: string
}

export function LoadingModal({ title, subtitle }: LoadingModalProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 bg-[#111111] border border-white/8 rounded-2xl px-10 py-8 shadow-2xl max-w-md mx-4">
        <Loader2 className="w-10 h-10 text-[#c9a84c] animate-spin" />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-['Cormorant_Garant'] text-2xl font-semibold text-[#f0ece3]">{title}</p>
          <p className="text-[#9a9080] text-sm leading-relaxed">{subtitle}</p>
        </div>
        <p className="text-xs tracking-widest text-[#5a5248] tabular-nums">
          {mm}:{ss}
        </p>
      </div>
    </div>
  )
}
