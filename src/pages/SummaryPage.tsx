import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useGardenStore } from '../store/gardenStore'
import { getPdfUrl } from '../api/client'
import { FieldCanvas } from '../components/summary/FieldCanvas'
import { FieldCanvas3D } from '../components/summary/FieldCanvas3D'
import { SpeciesLegend, type SpeciesEntry } from '../components/summary/SpeciesLegend'
import { speciesColor } from '../components/summary/speciesColor'
import { useEffect, useMemo, useRef, useState } from 'react'

const CANVAS_HEIGHT = 560

export function SummaryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { gardenLayout, reset, field, allPlants, selectedPlantIds, jobId } = useGardenStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(800)
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [hiddenSpecies, setHiddenSpecies] = useState<Set<string>>(new Set())
  const [pdfError, setPdfError] = useState<string | null>(null)

  const speciesList = useMemo<SpeciesEntry[]>(() => {
    if (!gardenLayout) return []

    // Lookup order:
    //  1. Exact name match across all plants
    //  2. Case-insensitive match across all plants
    //  3. Substring match restricted to the plants the user actually selected
    //     (those are the ones the backend used to generate this layout)
    const byExact  = new Map(allPlants.map(p => [p.name, p]))
    const byLower  = new Map(allPlants.map(p => [p.name.toLowerCase(), p]))
    const selected = allPlants.filter(p => selectedPlantIds.includes(p.id))

    const lookupPlant = (name: string) => {
      const lower = name.toLowerCase()
      return byExact.get(name)
        ?? byLower.get(lower)
        ?? selected.find(p =>
            p.name.toLowerCase().includes(lower) ||
            lower.includes(p.name.toLowerCase()),
          )
    }

    const map = new Map<string, SpeciesEntry>()
    for (const f of gardenLayout.features) {
      const p = f.properties as Record<string, unknown>
      if (p?.type === 'plant_instance') {
        const name = p.plant_name as string
        // MultiPoint: one feature holds all instances → count coordinates
        // Point / Polygon (legacy): one feature = one instance
        const instanceCount = f.geometry.type === 'MultiPoint'
          ? (f.geometry as import('geojson').MultiPoint).coordinates.length
          : 1
        const e = map.get(name)
        if (e) { e.count += instanceCount }
        else {
          const plant = lookupPlant(name)
          map.set(name, {
            name,
            color:            speciesColor(name).base,
            spread_m:         (p.spread_m as number) ?? 0,
            count:            instanceCount,
            plantingSeason:   plant?.plantingSeason,
            harvestingSeason: plant?.harvestingSeason,
            heightLabel:      plant?.heightLabel,
          })
        }
      } else if (p?.type === 'tree') {
        const name = p.name as string
        const e = map.get(name)
        if (e) { e.count++ }
        else {
          const plant = lookupPlant(name)
          map.set(name, {
            name,
            color:            speciesColor(name).base,
            spread_m:         (p.spread_m as number) ?? 0,
            height_m:         p.height_m as number | undefined,
            count:            1,
            plantingSeason:   plant?.plantingSeason,
            harvestingSeason: plant?.harvestingSeason,
            heightLabel:      plant?.heightLabel,
          })
        }
      }
    }
    return [...map.values()]
  }, [gardenLayout, allPlants, selectedPlantIds])

  const toggleSpecies = (name: string) => {
    setHiddenSpecies(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

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
    setPdfError(null)
    if (!jobId) {
      setPdfError('PDF not available — please regenerate the layout.')
      return
    }

    // Open a placeholder tab synchronously, while we're still inside the
    // click-event call stack. Popup blockers allow window.open here because
    // the call is part of the user gesture. If we waited until after the
    // awaits below, the browser would treat it as programmatic and block it.
    // We'll navigate this tab to the PDF once we have the bytes.
    const newTab = window.open('about:blank', '_blank')

    try {
      const signedUrl = await getPdfUrl(jobId)

      // Fetch the PDF bytes ourselves. The <a download> attribute is
      // *ignored* for cross-origin URLs, and our PDF lives on Supabase
      // Storage (a different origin). To force a download we have to
      // wrap the bytes as a Blob and mint a same-origin blob URL via
      // URL.createObjectURL — the download attribute honours that, and
      // the new tab can navigate to it too.
      const response = await fetch(signedUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      // (a) Save to disk
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'garden_layout.pdf'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // (b) Show in the placeholder tab we opened pre-await
      if (newTab) newTab.location.href = blobUrl

      // Blob URLs hold their bytes in memory until revoked. Give both
      // the save dialog and the new tab plenty of time to read the URL
      // before releasing it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
    } catch (e) {
      if (newTab) newTab.close()
      setPdfError(`Failed to download PDF: ${e instanceof Error ? e.message : String(e)}`)
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

      {/* View toggle + Canvas */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <div className="flex items-center gap-1 p-1 rounded-lg border border-white/8 bg-[#111]">
            {(['2d', '3d'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={[
                  'px-4 py-1 rounded-md text-xs font-medium tracking-widest uppercase transition-all cursor-pointer',
                  view === v
                    ? 'bg-[#c9a84c] text-[#0a0a0a]'
                    : 'text-[#9a9080] hover:text-[#f0ece3] bg-transparent',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={containerRef}
          className="w-full rounded-2xl overflow-hidden border border-white/8 bg-[#0d0d0d]"
        >
          {view === '2d' ? (
            <FieldCanvas
              layout={gardenLayout}
              canvasWidth={canvasWidth}
              canvasHeight={CANVAS_HEIGHT}
              hiddenSpecies={hiddenSpecies}
            />
          ) : (
            <FieldCanvas3D hiddenSpecies={hiddenSpecies} speciesList={speciesList} />
          )}
        </div>

        {/* Shared species legend — works for both 2D and 3D */}
        <SpeciesLegend
          entries={speciesList}
          hidden={hiddenSpecies}
          onToggle={toggleSpecies}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!gardenLayout}
            className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-medium text-sm tracking-wide rounded-lg hover:bg-[#e0c068] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('summary.download_pdf')}
          </button>
          <button
            type="button"
            onClick={handleStartOver}
            className="px-8 py-3 border border-[#c9a84c]/40 text-[#c9a84c] font-medium text-sm tracking-wide rounded-lg hover:bg-[#c9a84c]/8 transition-all cursor-pointer bg-transparent"
          >
            {t('summary.start_over')}
          </button>
        </div>
        {pdfError && (
          <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
            {pdfError}
          </p>
        )}
      </div>
    </div>
  )
}
