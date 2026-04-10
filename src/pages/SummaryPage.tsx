import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useGardenStore } from '../store/gardenStore'
import { FieldCanvas } from '../components/summary/FieldCanvas'
import { downloadLayoutPdf } from '../api/client'
import { useEffect, useRef, useState } from 'react'

const CANVAS_HEIGHT = 560

export function SummaryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { gardenLayout, reset, field, selectedPlantIds, pvSystem } = useGardenStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(800)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Measure container width for responsive canvas
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Redirect back if no layout (e.g. user navigated directly to /summary)
  useEffect(() => {
    if (!gardenLayout) navigate('/planner', { replace: true })
  }, [gardenLayout, navigate])

  const handleStartOver = () => {
    reset()
    navigate('/planner')
  }

  const handleDownloadPdf = async () => {
    if (!field || !pvSystem) return
    setPdfLoading(true)
    try {
      await downloadLayoutPdf({
        selected_plant_ids: selectedPlantIds,
        field_length: field.length,
        field_width: field.width,
        latitude: field.north_coordinate,
        pv_production: pvSystem.pv_production,
        battery_size: pvSystem.battery_size,
        system_height: pvSystem.system_height,
      })
    } finally {
      setPdfLoading(false)
    }
  }

  if (!gardenLayout) return null

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-12 gap-10">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <p className="text-xs tracking-widest text-[#c9a84c] uppercase">
          {field ? `${field.length} × ${field.width} m` : ''}
        </p>
        <h1 className="font-['Cormorant_Garant'] text-5xl font-semibold text-[#f0ece3]">
          {t('summary.title')}
        </h1>
        <p className="text-[#9a9080] text-sm leading-relaxed max-w-xl">
          {t('summary.subtitle')}
        </p>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full rounded-2xl overflow-hidden border border-white/8 bg-[#0d0d0d]"
      >
        <FieldCanvas
          layout={gardenLayout}
          canvasWidth={canvasWidth}
          canvasHeight={CANVAS_HEIGHT}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfLoading || !field || !pvSystem}
          className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-medium text-sm tracking-wide rounded-lg hover:bg-[#e0c068] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {pdfLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-[#0a0a0a]/40 border-t-[#0a0a0a] rounded-full animate-spin" />
              {t('summary.pdf_loading')}
            </>
          ) : (
            t('summary.download_pdf')
          )}
        </button>
        <button
          type="button"
          onClick={handleStartOver}
          className="px-8 py-3 border border-[#c9a84c]/40 text-[#c9a84c] font-medium text-sm tracking-wide rounded-lg hover:bg-[#c9a84c]/8 transition-all cursor-pointer bg-transparent"
        >
          {t('summary.start_over')}
        </button>
      </div>
    </div>
  )
}
