import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGardenStore } from '../../store/gardenStore'
import { getAllPlants } from '../../api/client'
import { PlantCard } from './PlantCard'
import { buildBubbles, useRadialHover, RadialRing, DropletIcon, HeightIcon } from './plantRadial'
import type { Plant } from '../../models/Plant'

export function PlantSelector() {
  const { t } = useTranslation()
  const { allPlants, setAllPlants, selectedPlantIds, togglePlant, setStep } = useGardenStore()

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (allPlants.length > 0) return
    setLoading(true)
    getAllPlants()
      .then(setAllPlants)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [allPlants.length, setAllPlants])

  const available = useMemo(() => {
    const q = search.toLowerCase()
    return allPlants.filter(
      (p) => !selectedPlantIds.includes(p.id) &&
        (q === '' || p.name.toLowerCase().includes(q))
    )
  }, [allPlants, search, selectedPlantIds])

  const selected = useMemo(
    () => allPlants.filter((p) => selectedPlantIds.includes(p.id)),
    [allPlants, selectedPlantIds]
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
      <div className="flex gap-5 min-h-[380px]">

        {/* Left: search + available grid */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
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

          {loading ? (
            <LoadingGrid />
          ) : error ? (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {t('step2.error')}
            </p>
          ) : available.length === 0 ? (
            <p className="text-[#5a5248] text-sm py-8 text-center">
              {selected.length === 0 ? t('step2.no_results') : 'All matching plants selected.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1" style={{ maxHeight: 340 }}>
              {available.map((plant) => (
                <PlantCard key={plant.id} plant={plant} selected={false} onToggle={togglePlant} />
              ))}
            </div>
          )}
        </div>

        {/* Right: selected sidebar */}
        <div className="w-44 shrink-0 flex flex-col gap-3">
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
                <SelectedPlantChip key={plant.id} plant={plant} onRemove={togglePlant} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-6 py-3 border border-white/10 text-[#9a9080] font-medium text-sm tracking-wide rounded-lg hover:border-white/20 hover:text-[#f0ece3] transition-all cursor-pointer bg-transparent"
        >
          {t('wizard.back')}
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={selected.length === 0}
          className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_rgba(201,168,76,0.2)] hover:shadow-[0_0_28px_rgba(201,168,76,0.35)] cursor-pointer"
        >
          {t('wizard.next')}
        </button>
      </div>
    </div>
  )
}

// ─── Selected plant chip (sidebar item) ───────────────────────────────────────

function SelectedPlantChip({ plant, onRemove }: { plant: Plant; onRemove: (id: number) => void }) {
  const { ref, rect, onMouseEnter, onMouseLeave } = useRadialHover<HTMLDivElement>()

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="flex flex-col gap-2 p-3 rounded-xl bg-[#111111] border border-[#c9a84c]/25 hover:border-[#c9a84c]/50 transition-all"
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-base leading-none">🌿</span>
          <button
            type="button"
            onClick={() => onRemove(plant.id)}
            className="text-[#5a5248] hover:text-[#f0ece3] transition-colors cursor-pointer bg-transparent border-none p-0 leading-none"
            aria-label={`Remove ${plant.name}`}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
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
