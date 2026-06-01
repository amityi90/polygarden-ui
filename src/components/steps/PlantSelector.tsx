import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGardenStore } from '../../store/gardenStore'
import { getAllPlants } from '../../api/client'
import { PlantCard } from './PlantCard'
import { buildBubbles, useRadialHover, RadialRing, DropletIcon, HeightIcon } from './plantRadial'
import type { Plant } from '../../models/Plant'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if `month` (1–12) falls within [start, end], handling year-wrap. */
function monthInRange(month: number, start: number, end: number): boolean {
  if (end >= start) return month >= start && month <= end
  return month >= start || month <= end
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlantSelectorProps {
  /** Back action. Defaults to the field flow's "go to step 1". */
  onBack?: () => void
  /** Next/primary action. Defaults to the field flow's "go to step 3". */
  onNext?: () => void
  /** Label for the primary button. Defaults to the field flow's "Next". */
  nextLabel?: string
  /** Whether the primary button shows a busy state. */
  nextBusy?: boolean
  /** Garden flow: hide trees from the catalog and the Type filter. */
  hideTrees?: boolean
  /** Override the selection source. Defaults to the field flow's selectedPlantIds. */
  selectedIds?: number[]
  /** Override the toggle handler. Defaults to the field flow's togglePlant. */
  onToggle?: (id: number) => void
}

export function PlantSelector({ onBack, onNext, nextLabel, nextBusy, hideTrees, selectedIds, onToggle }: PlantSelectorProps = {}) {
  const { t } = useTranslation()
  const { allPlants, setAllPlants, selectedPlantIds, togglePlant, setStep } = useGardenStore()

  const selIds = selectedIds ?? selectedPlantIds
  const toggle = onToggle ?? togglePlant

  const handleBack = onBack ?? (() => setStep(1))
  const handleNext = onNext ?? (() => setStep(3))
  const primaryLabel = nextLabel ?? t('wizard.next')

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)   // selected chip showing its companions

  // Filters
  const [filterType,          setFilterType]          = useState<'all' | 'plant' | 'tree'>('all')
  const [filterLight,         setFilterLight]         = useState<'all' | 'sun' | 'shade'>('all')
  const [filterHarvestMonths, setFilterHarvestMonths] = useState<Set<number>>(new Set())
  const [filterPlantMonths,   setFilterPlantMonths]   = useState<Set<number>>(new Set())

  useEffect(() => {
    if (allPlants.length > 0) return
    setLoading(true)
    getAllPlants()
      .then(setAllPlants)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [allPlants.length, setAllPlants])

  const toggleHarvestMonth = (m: number) =>
    setFilterHarvestMonths(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  const togglePlantMonth = (m: number) =>
    setFilterPlantMonths(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  const hasActiveFilters =
    filterType !== 'all' || filterLight !== 'all' ||
    filterHarvestMonths.size > 0 || filterPlantMonths.size > 0

  const clearFilters = () => {
    setFilterType('all')
    setFilterLight('all')
    setFilterHarvestMonths(new Set())
    setFilterPlantMonths(new Set())
  }

  const available = useMemo(() => {
    const q = search.toLowerCase()
    return allPlants.filter(p => {
      if (selIds.includes(p.id)) return false
      if (hideTrees && p.isTree) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (filterType === 'plant' && p.isTree) return false
      if (filterType === 'tree'  && !p.isTree) return false
      if (filterLight === 'sun'   && p.shadow) return false
      if (filterLight === 'shade' && !p.shadow) return false
      if (filterHarvestMonths.size > 0) {
        const ok = [...filterHarvestMonths].some(m => monthInRange(m, p.harvestingStart, p.harvestingEnd))
        if (!ok) return false
      }
      if (filterPlantMonths.size > 0) {
        const ok = [...filterPlantMonths].some(m => monthInRange(m, p.plantingStart, p.plantingEnd))
        if (!ok) return false
      }
      return true
    })
  }, [allPlants, search, selIds, filterType, filterLight, filterHarvestMonths, filterPlantMonths, hideTrees])

  const selected = useMemo(
    () => allPlants.filter((p) => selIds.includes(p.id)),
    [allPlants, selIds]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h2 className="font-['Cormorant_Garant'] text-4xl font-semibold text-[#f0ece3]">
          {t('step2.title')}
        </h2>
        <p className="text-[#9a9080] text-sm leading-relaxed">
          {t('step2.subtitle')}
        </p>
      </div>

      {/* Two-column layout: grid + sidebar */}
      <div className="flex flex-col md:flex-row gap-5">

        {/* Left: search + filters + available grid */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5248] pointer-events-none"
              width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('step2.search')}
              className="w-full bg-[#111111] border border-white/10 rounded-lg pl-11 pr-4 py-3 text-[#f0ece3] placeholder-[#5a5248] text-sm focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2.5 p-3 rounded-lg border border-white/6 bg-[#0d0d0d]">

            {/* Row 1: Type + Light */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Type — hidden in the garden flow (plants only, no trees) */}
              {!hideTrees && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5a5248] uppercase tracking-widest w-9 shrink-0">Type</span>
                <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-white/8 bg-[#111]">
                  {(['all', 'plant', 'tree'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFilterType(v)}
                      className={[
                        'px-2.5 py-0.5 rounded text-[10px] font-medium tracking-wide transition-all cursor-pointer',
                        filterType === v
                          ? 'bg-[#c9a84c] text-[#0a0a0a]'
                          : 'text-[#5a5248] hover:text-[#9a9080] bg-transparent',
                      ].join(' ')}
                    >
                      {v === 'all' ? 'All' : v === 'plant' ? '🌿 Plant' : '🌳 Tree'}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Light */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5a5248] uppercase tracking-widest w-9 shrink-0">Light</span>
                <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-white/8 bg-[#111]">
                  {(['all', 'sun', 'shade'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFilterLight(v)}
                      className={[
                        'px-2.5 py-0.5 rounded text-[10px] font-medium tracking-wide transition-all cursor-pointer',
                        filterLight === v
                          ? 'bg-[#c9a84c] text-[#0a0a0a]'
                          : 'text-[#5a5248] hover:text-[#9a9080] bg-transparent',
                      ].join(' ')}
                    >
                      {v === 'all' ? 'All' : v === 'sun' ? '☀ Sun' : '🌑 Shade'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto text-[10px] text-[#c9a84c]/60 hover:text-[#c9a84c] transition-colors cursor-pointer bg-transparent border-0 uppercase tracking-widest"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Row 2: Harvest months */}
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-[#5a5248] uppercase tracking-widest w-14 shrink-0 pt-0.5">
                Harvest
              </span>
              <div className="flex flex-wrap gap-1">
                {MONTHS.map((m, i) => {
                  const month = i + 1
                  const active = filterHarvestMonths.has(month)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleHarvestMonth(month)}
                      className={[
                        'px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer border',
                        active
                          ? 'bg-[#c9a84c]/20 border-[#c9a84c]/60 text-[#c9a84c]'
                          : 'bg-transparent border-white/8 text-[#5a5248] hover:text-[#9a9080] hover:border-white/20',
                      ].join(' ')}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Row 3: Planting months */}
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-[#5a5248] uppercase tracking-widest w-14 shrink-0 pt-0.5">
                Plant
              </span>
              <div className="flex flex-wrap gap-1">
                {MONTHS.map((m, i) => {
                  const month = i + 1
                  const active = filterPlantMonths.has(month)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => togglePlantMonth(month)}
                      className={[
                        'px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer border',
                        active
                          ? 'bg-[#4e8f63]/20 border-[#4e8f63]/60 text-[#4e8f63]'
                          : 'bg-transparent border-white/8 text-[#5a5248] hover:text-[#9a9080] hover:border-white/20',
                      ].join(' ')}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <LoadingGrid />
          ) : error ? (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {t('step2.error')}
            </p>
          ) : available.length === 0 ? (
            <p className="text-[#5a5248] text-sm py-8 text-center">
              {!hasActiveFilters && selected.length === 0
                ? t('step2.no_results')
                : 'No plants match the current filters.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1" style={{ maxHeight: 340 }}>
              {available.map((plant) => (
                <PlantCard key={plant.id} plant={plant} selected={false} onToggle={toggle} />
              ))}
            </div>
          )}
        </div>

        {/* Right: selected sidebar */}
        <div className="w-full md:w-44 md:shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-widest text-[#9a9080] uppercase">
              Selected
            </span>
            {selected.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/30 text-[#c9a84c] text-xs font-medium">
                {selected.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 340 }}>
            {selected.length === 0 ? (
              <p className="text-[#5a5248] text-xs leading-relaxed pt-1">
                Click a plant to add it here.
              </p>
            ) : (
              selected.map((plant) => (
                <SelectedPlantChip
                  key={plant.id}
                  plant={plant}
                  allPlants={allPlants}
                  selectedIds={selIds}
                  onToggle={toggle}
                  hideTrees={hideTrees}
                  expanded={expandedId === plant.id}
                  onToggleExpand={() => setExpandedId((id) => (id === plant.id ? null : plant.id))}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="px-6 py-3 border border-white/10 text-[#9a9080] font-medium text-sm tracking-wide rounded-lg hover:border-white/20 hover:text-[#f0ece3] transition-all cursor-pointer bg-transparent"
        >
          {t('wizard.back')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={selected.length === 0 || nextBusy}
          className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_rgba(201,168,76,0.2)] hover:shadow-[0_0_28px_rgba(201,168,76,0.35)] cursor-pointer"
        >
          {nextBusy ? '…' : primaryLabel}
        </button>
      </div>
    </div>
  )
}

// ─── Selected plant chip (sidebar item) ───────────────────────────────────────

interface SelectedPlantChipProps {
  plant: Plant
  allPlants: Plant[]
  selectedIds: number[]
  onToggle: (id: number) => void
  hideTrees?: boolean
  expanded: boolean
  onToggleExpand: () => void
}

function SelectedPlantChip({
  plant, allPlants, selectedIds, onToggle, hideTrees, expanded, onToggleExpand,
}: SelectedPlantChipProps) {
  const { ref, rect, onMouseEnter, onMouseLeave } = useRadialHover<HTMLDivElement>()

  // The plant's companions present in the catalog (trees hidden in the garden flow).
  const companions = useMemo(() => {
    const ids = new Set(plant.companionIds)
    return allPlants.filter((p) => ids.has(p.id) && (!hideTrees || !p.isTree))
  }, [plant, allPlants, hideTrees])

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="flex flex-col gap-2 p-3 rounded-xl bg-[#111111] border border-[#c9a84c]/25 hover:border-[#c9a84c]/50 transition-all"
      >
        {/* Click the body to reveal companions */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleExpand}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleExpand() }}
          className="flex flex-col gap-2 cursor-pointer"
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-1">
            <span className="text-base leading-none">🌿</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggle(plant.id) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onToggle(plant.id) } }}
              className="text-[#5a5248] hover:text-[#f0ece3] transition-colors cursor-pointer leading-none"
              aria-label={`Remove ${plant.name}`}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </div>

          <p className="font-['Cormorant_Garant'] text-sm font-semibold text-[#f0ece3] leading-tight">
            {plant.name}
          </p>

          <div className="flex items-center gap-2 text-[#9a9080]">
            <span className="flex items-center gap-1 text-[10px]">
              <DropletIcon size={10} /> {plant.waterLabel}
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <HeightIcon size={10} /> {plant.heightLabel}
            </span>
          </div>
        </div>

        {/* Companion picker */}
        {expanded && (
          <div className="flex flex-col gap-1.5 pt-2 mt-1 border-t border-white/8">
            <span className="text-[9px] uppercase tracking-widest text-[#5a5248]">Companions</span>
            {companions.length === 0 ? (
              <span className="text-[10px] text-[#5a5248]">No companions</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {companions.map((c) => {
                  const isSel = selectedIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onToggle(c.id)}
                      className={[
                        'px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all cursor-pointer',
                        isSel
                          ? 'bg-[#c9a84c]/20 border-[#c9a84c]/60 text-[#c9a84c]'
                          : 'bg-transparent border-white/10 text-[#9a9080] hover:text-[#f0ece3] hover:border-white/25',
                      ].join(' ')}
                      title={isSel ? `Remove ${c.name}` : `Add ${c.name}`}
                    >
                      {isSel ? '✓ ' : '+ '}{c.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {rect && <RadialRing bubbles={buildBubbles(plant)} rect={rect} radius={100} />}
    </>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-[#111111] border border-white/5 animate-pulse" />
      ))}
    </div>
  )
}
