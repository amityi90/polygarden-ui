import { useState } from 'react'

export interface SpeciesEntry {
  name:               string
  color:              string
  spread_m:           number
  height_m?:          number
  count:              number
  // enriched from Plant model when available
  plantingSeason?:    string   // e.g. "Mar – May"
  harvestingSeason?:  string   // e.g. "Jun – Sep"
  heightLabel?:       string   // e.g. "45 cm"
}

interface SpeciesLegendProps {
  entries:  SpeciesEntry[]
  hidden:   ReadonlySet<string>
  onToggle: (name: string) => void
}

export function SpeciesLegend({ entries, hidden, onToggle }: SpeciesLegendProps) {
  const [hoveredName, setHoveredName] = useState<string | null>(null)

  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(entry => {
        const isHidden  = hidden.has(entry.name)
        const isHovered = hoveredName === entry.name

        return (
          <div
            key={entry.name}
            className="relative"
            onMouseEnter={() => setHoveredName(entry.name)}
            onMouseLeave={() => setHoveredName(null)}
          >
            <button
              type="button"
              onClick={() => onToggle(entry.name)}
              className={[
                'flex items-center gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer bg-transparent border-0',
                isHovered ? 'bg-white/8' : '',
              ].join(' ')}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 transition-opacity"
                style={{ backgroundColor: entry.color, opacity: isHidden ? 0.2 : 1 }}
              />
              <span className={[
                'text-xs transition-colors',
                isHidden ? 'text-[#3a3530] line-through' : 'text-[#9a9080]',
              ].join(' ')}>
                {entry.name}
              </span>
            </button>

            {isHovered && (
              <div className="absolute bottom-full left-0 mb-2 z-10 min-w-[200px] rounded-lg border border-[#c9a84c]/40 bg-[#1a1a1a]/98 px-3 py-2 shadow-lg pointer-events-none">
                <p className="text-[12px] font-semibold text-[#f0ece3] mb-2">{entry.name}</p>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-[#9a9080]">
                    <span className="text-[#6b6358]">In field: </span>{entry.count}
                  </p>
                  <p className="text-[11px] text-[#9a9080]">
                    <span className="text-[#6b6358]">Spread: </span>{entry.spread_m} m
                  </p>
                  {entry.heightLabel && (
                    <p className="text-[11px] text-[#9a9080]">
                      <span className="text-[#6b6358]">Height: </span>{entry.heightLabel}
                    </p>
                  )}
                  {entry.plantingSeason && (
                    <p className="text-[11px] text-[#9a9080]">
                      <span className="text-[#6b6358]">Plant: </span>{entry.plantingSeason}
                    </p>
                  )}
                  {entry.harvestingSeason && (
                    <p className="text-[11px] text-[#9a9080]">
                      <span className="text-[#6b6358]">Harvest: </span>{entry.harvestingSeason}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-[#c9a84c]/40 mt-2 border-t border-white/5 pt-1.5">
                  {isHidden ? 'Click to show' : 'Click to hide'}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
