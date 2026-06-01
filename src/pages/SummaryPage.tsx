import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useGardenStore } from '../store/gardenStore'
import { getPdfUrl, getGardenPdfUrl, streamGarden } from '../api/client'
import { FieldCanvas } from '../components/summary/FieldCanvas'
import { FieldCanvas3D } from '../components/summary/FieldCanvas3D'
import { SpeciesLegend, type SpeciesEntry } from '../components/summary/SpeciesLegend'
import { speciesColor } from '../components/summary/speciesColor'
import { useEffect, useMemo, useRef, useState } from 'react'

const CANVAS_HEIGHT = 560

export function SummaryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    gardenLayout, reset, field, allPlants, selectedPlantIds, gardenSelectedPlantIds, jobId,
    summaryMode, layoutStatus, layoutError,
    setGardenLayout, setLayoutStatus, setLayoutError,
  } = useGardenStore()
  const isStreaming = layoutStatus === 'streaming'
  const activeSelectedIds = summaryMode === 'garden' ? gardenSelectedPlantIds : selectedPlantIds
  // 3D is disabled for the garden until it's fully built — while streaming the
  // scene would be re-rendered every poll, which blocks interaction.
  const threeDReady = summaryMode !== 'garden' || layoutStatus === 'done'
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
    const selected = allPlants.filter(p => activeSelectedIds.includes(p.id))

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
  }, [gardenLayout, allPlants, activeSelectedIds])

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

  // Garden flow: run the streaming poll HERE (not in the wizard) so navigating
  // away from the wizard doesn't abort it. Each partial replaces the layout and
  // the canvas re-renders, so the garden visibly grows. No-op for the field flow.
  useEffect(() => {
    if (summaryMode !== 'garden' || layoutStatus !== 'streaming' || !jobId) return
    const abort = new AbortController()
    streamGarden(jobId, (partial) => setGardenLayout(partial), abort.signal)
      .then(() => setLayoutStatus('done'))
      .catch((e) => {
        if ((e as DOMException)?.name === 'AbortError') return
        setLayoutStatus('failed')
        setLayoutError(e instanceof Error ? e.message : String(e))
      })
    return () => abort.abort()
  }, [summaryMode, layoutStatus, jobId, setGardenLayout, setLayoutStatus, setLayoutError])

  // Redirect back if there's no layout AND we're not mid-stream (e.g. user
  // navigated directly to /summary). The garden seeds a bounds-only layout
  // before navigating, so it never bounces.
  useEffect(() => {
    if (!gardenLayout && layoutStatus === 'idle') navigate('/planner', { replace: true })
  }, [gardenLayout, layoutStatus, navigate])

  // Keep the view on 2D while 3D is locked (garden not yet done).
  useEffect(() => {
    if (!threeDReady && view === '3d') setView('2d')
  }, [threeDReady, view])

  const handleStartOver = () => {
    if (summaryMode === 'garden') {
      // Don't clear state here — that would trip the redirect guard above and
      // bounce to /planner. Navigate to /garden and let GardenWizardPage reset
      // the garden form on arrival (signalled by `fresh`).
      navigate('/garden', { state: { fresh: true } })
    } else {
      reset()
      navigate('/planner')
    }
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
      const signedUrl = await (summaryMode === 'garden' ? getGardenPdfUrl : getPdfUrl)(jobId)

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

      {/* Streaming / failure status (garden flow only) */}
      {isStreaming && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#c9a84c]/30 bg-[#c9a84c]/8">
          <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
          <span className="text-sm text-[#c9a84c]">{t('garden.building')}</span>
        </div>
      )}
      {layoutStatus === 'failed' && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {layoutError ?? 'Failed to generate the garden.'}
        </p>
      )}

      {/* View toggle + Canvas */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <div className="flex items-center gap-1 p-1 rounded-lg border border-white/8 bg-[#111]">
            {(['2d', '3d'] as const).map(v => {
              const locked = v === '3d' && !threeDReady
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => !locked && setView(v)}
                  disabled={locked}
                  title={locked ? t('summary.threed_locked') : undefined}
                  className={[
                    'px-4 py-1 rounded-md text-xs font-medium tracking-widest uppercase transition-all',
                    locked
                      ? 'text-[#5a5248] cursor-not-allowed bg-transparent'
                      : view === v
                        ? 'bg-[#c9a84c] text-[#0a0a0a] cursor-pointer'
                        : 'text-[#9a9080] hover:text-[#f0ece3] bg-transparent cursor-pointer',
                  ].join(' ')}
                >
                  {v}
                </button>
              )
            })}
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
              animateAppear={summaryMode === 'garden'}
            />
          ) : (
            <FieldCanvas3D
              hiddenSpecies={hiddenSpecies}
              speciesList={speciesList}
              animateAppear={summaryMode === 'garden'}
            />
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
            disabled={!gardenLayout || isStreaming}
            className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-medium text-sm tracking-wide rounded-lg hover:bg-[#e0c068] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? t('garden.building') : t('summary.download_pdf')}
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
