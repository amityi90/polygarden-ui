import type { Plant } from '../../models/Plant'
import {
  buildBubbles, useRadialHover, RadialRing,
  DropletIcon, HeightIcon,
} from './plantRadial'

interface PlantCardProps {
  plant: Plant
  selected: boolean
  onToggle: (id: number) => void
}

export function PlantCard({ plant, selected, onToggle }: PlantCardProps) {
  const { ref, rect, onMouseEnter, onMouseLeave } = useRadialHover<HTMLButtonElement>()

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => onToggle(plant.id)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={[
          'relative flex flex-col gap-3 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer w-full',
          'hover:border-[#c9a84c]/40 hover:bg-[#1a1a1a]',
          selected
            ? 'bg-[#c9a84c]/8 border-[#c9a84c]/60 shadow-[0_0_16px_rgba(201,168,76,0.12)]'
            : 'bg-[#111111] border-white/8',
        ].join(' ')}
      >
        {selected && (
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#c9a84c] flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <div className="w-10 h-10 rounded-lg bg-[#3a6b4a]/20 border border-[#3a6b4a]/30 flex items-center justify-center text-lg">
          🌿
        </div>

        <p className="font-['Cormorant_Garant'] text-base font-semibold text-[#f0ece3] leading-tight">
          {plant.name}
        </p>

        <div className="flex items-center gap-3 text-[#9a9080]">
          <span className="flex items-center gap-1 text-[11px]">
            <DropletIcon size={11} /> {plant.waterLabel}
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <HeightIcon size={11} /> {plant.heightLabel}
          </span>
        </div>
      </button>

      {rect && <RadialRing bubbles={buildBubbles(plant)} rect={rect} />}
    </>
  )
}
