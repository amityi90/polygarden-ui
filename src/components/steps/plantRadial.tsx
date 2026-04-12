/**
 * Shared radial hover ring — used by both PlantCard (grid) and SelectedPlantChip (sidebar).
 * Extracted so the logic lives in one place.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Plant } from '../../models/Plant'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BubbleDef {
  icon: React.ReactNode
  value: string
  color: string
}

// ─── Build bubble data from a Plant instance ──────────────────────────────────

export function buildBubbles(plant: Plant): BubbleDef[] {
  return [
    { icon: <SeedlingIcon />,  value: plant.plantingSeason,   color: '#4e8f63' },
    { icon: <HarvestIcon />,   value: plant.harvestingSeason, color: '#c9a84c' },
    { icon: <DropletIcon />,   value: plant.waterLabel,       color: '#4a90d9' },
    { icon: <ShadowIcon />,    value: plant.shadowLabel,      color: plant.shadow ? '#9a9080' : '#c9a84c' },
    { icon: <LeafWaterIcon />, value: plant.bodyWaterLabel,   color: plant.bodyWater ? '#4a90d9' : '#9a9080' },
    { icon: <HeightIcon />,    value: plant.heightLabel,      color: '#9a9080' },
    { icon: <SpreadIcon />,    value: plant.spreadLabel,      color: '#9a9080' },
    { icon: <TreeIcon />,      value: plant.isTreeLabel,      color: plant.isTree ? '#8b6c42' : '#4e8f63' },
  ]
}

// ─── Hook: attach hover tracking to any element ref ──────────────────────────

export function useRadialHover<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const onMouseEnter = useCallback(() => {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
  }, [])

  const onMouseLeave = useCallback(() => setRect(null), [])

  useEffect(() => {
    if (!rect) return
    const close = () => setRect(null)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [rect])

  return { ref, rect, onMouseEnter, onMouseLeave }
}

// ─── Radial ring portal ────────────────────────────────────────────────────────

interface RadialRingProps {
  bubbles: BubbleDef[]
  rect: DOMRect
  radius?: number
}

export function RadialRing({ bubbles, rect, radius = 115 }: RadialRingProps) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const n = bubbles.length

  return createPortal(
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      {bubbles.map((bubble, i) => {
        const angleRad = (-90 + i * (360 / n)) * (Math.PI / 180)
        const x = cx + radius * Math.cos(angleRad)
        const y = cy + radius * Math.sin(angleRad)

        return (
          <div
            key={i}
            className="absolute flex flex-col items-center gap-1"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              animation: `radialPop 220ms ${i * 25}ms cubic-bezier(0.34,1.56,0.64,1) both`,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: `color-mix(in srgb, ${bubble.color} 18%, #111)`,
                border: `1px solid ${bubble.color}55`,
                boxShadow: `0 0 10px ${bubble.color}22`,
                color: bubble.color,
              }}
            >
              {bubble.icon}
            </div>
            <span
              className="text-[9px] font-medium tracking-wide whitespace-nowrap px-1.5 py-0.5 rounded"
              style={{
                color: bubble.color,
                backgroundColor: `color-mix(in srgb, ${bubble.color} 10%, #0a0a0a)`,
                border: `1px solid ${bubble.color}30`,
              }}
            >
              {bubble.value}
            </span>
          </div>
        )
      })}
    </div>,
    document.body
  )
}

// ─── SVG Icons (exported so PlantCard can use them in its compact row) ────────

export function DropletIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 1C6 1 2 5.5 2 7.5a4 4 0 008 0C10 5.5 6 1 6 1z"
        fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function HeightIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M3 3.5L6 1l3 2.5M3 8.5L6 11l3-2.5"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShadowIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="2.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
      <path d="M6 1v1M6 10v1M1 6h1M10 6h1M2.5 2.5l.7.7M8.8 8.8l.7.7M9.5 2.5l-.7.7M3.2 8.8l-.7.7"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

export function LeafWaterIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 10C2 10 3 5 8 3c0 4-3 6-6 7z"
        fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <path d="M9.5 7.5a1 1 0 11-2 0c0-.6 1-2 1-2s1 1.4 1 2z"
        fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  )
}

export function SpreadIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M1 6h10M3 4L1 6l2 2M9 4l2 2-2 2"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SeedlingIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 11V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 6C6 6 3 5 2 3c2 0 4 1 4 3z"
        fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="0.8" />
      <path d="M6 7C6 7 9 6 10 4c-2 0-4 1-4 3z"
        fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

export function HarvestIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1"
        fill="currentColor" fillOpacity="0.25" />
      <path d="M6 7v4M4 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

export function TreeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 1L2 6h2.5L2.5 10h7L7.5 6H10L6 1z"
        fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M6 10v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function SunIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l-1.41 1.41M4.93 19.07l1.41-1.41"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ShadeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Same rays as SunIcon */}
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l-1.41 1.41M4.93 19.07l1.41-1.41"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Sun circle — faint, so the blocker reads clearly */}
      <circle cx="12" cy="12" r="5"
        stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      {/* Blocker: solid half-disc covering the bottom of the sun */}
      <path d="M7 12a5 5 0 0 0 10 0Z" fill="currentColor" fillOpacity="0.9" />
    </svg>
  )
}
