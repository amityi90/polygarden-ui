/**
 * FieldCanvas — renders the GeoJSON garden layout on a plain HTML5 canvas.
 *
 * Why plain canvas (not react-konva)?
 * ─────────────────────────────────────
 * With hundreds of shapes, react-konva creates one JS object per shape,
 * each with event listeners — this stalls the browser. A plain <canvas>
 * draws everything in a single 2D draw call with no per-shape objects.
 * We do our own hit-testing on mousemove instead of relying on Konva events.
 *
 * Coordinate system:
 * ──────────────────
 * GeoPandas outputs coordinates in field-space meters (0,0 = SW corner).
 * We apply:  canvas_x = (geo_x - minX) * scale + PADDING
 *            canvas_y = canvasH - (geo_y - minY) * scale - PADDING   (Y flipped)
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Polygon } from 'geojson'
import { useTranslation } from 'react-i18next'

interface FieldCanvasProps {
  layout: FeatureCollection
  canvasWidth: number
  canvasHeight: number
}

// ─── Feature property types ───────────────────────────────────────────────────

interface PlantRowProps { type: 'plant_row'; row_index: number; plants: string[] }
interface TreeProps     { type: 'tree';      center_x: number; center_y: number; radius_m: number; name?: string }
interface PVRowProps    { type: 'pv_row';    row_index: number; kw: number }
interface GapProps      { type: 'gap' }
interface ShadowProps   { type: 'shadow' }

type FeatureProps = PlantRowProps | TreeProps | PVRowProps | GapProps | ShadowProps

// ─── Internal draw item (precomputed canvas coords) ───────────────────────────

interface RectItem {
  kind: 'rect'
  props: FeatureProps
  x: number; y: number; w: number; h: number
  baseColor: string; hoverColor: string
  opacity: number
  strokeColor: string | null
  label: string | null   // PV row kW label
}

interface CircleItem {
  kind: 'circle'
  props: FeatureProps
  cx: number; cy: number; r: number
  baseColor: string; hoverColor: string
}

type DrawItem = RectItem | CircleItem

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = 32
const COLORS = {
  plant_row:       '#3a6b4a',
  plant_row_hover: '#4e8f63',
  pv_row:          '#c9a84c',
  pv_row_hover:    '#e0c068',
  gap:             '#2a1f0e',
  gap_hover:       '#3d2e14',
  shadow:          '#888888',
  shadow_hover:    '#aaaaaa',
}

const TREE_PALETTE: { base: string; hover: string }[] = [
  { base: '#2a6b9b', hover: '#3d90cc' },
  { base: '#8b4513', hover: '#b05a1a' },
  { base: '#6a0dad', hover: '#8b1fd6' },
  { base: '#9b6a00', hover: '#c98900' },
  { base: '#005f5f', hover: '#007a7a' },
  { base: '#7a1f3d', hover: '#a02850' },
  { base: '#3d6b00', hover: '#52900a' },
  { base: '#5a3a7a', hover: '#7a50a0' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeBBox(fc: FeatureCollection) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of fc.features) {
    if (f.geometry.type !== 'Polygon') continue
    for (const ring of (f.geometry as Polygon).coordinates) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (y < minY) minY = y
        if (x > maxX) maxX = x; if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

function buildTreeColorMap(features: FeatureCollection['features']): Map<string, { base: string; hover: string }> {
  const names = [...new Set(
    features
      .filter(f => (f.properties as FeatureProps).type === 'tree')
      .map(f => (f.properties as TreeProps).name ?? 'Unknown'),
  )]
  return new Map(names.map((name, i) => [name, TREE_PALETTE[i % TREE_PALETTE.length]]))
}

function tooltipLines(props: FeatureProps, t: (k: string, o?: Record<string, unknown>) => string): string[] {
  if (props.type === 'plant_row')
    return [t('summary.tooltip.plant_row', { index: props.row_index + 1 }), ...(props.plants ?? []).map(p => `  · ${p}`)]
  if (props.type === 'tree')
    return [props.name ? `Tree: ${props.name}` : 'Tree']
  if (props.type === 'pv_row')
    return [t('summary.tooltip.pv_row', { index: props.row_index + 1, kw: props.kw })]
  if (props.type === 'shadow')
    return ['Shadow zone']
  return [t('summary.tooltip.gap')]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FieldCanvas({ layout, canvasWidth, canvasHeight }: FieldCanvasProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  // Precompute transform parameters
  const { minX, minY, maxX, maxY } = useMemo(() => computeBBox(layout), [layout])
  const scale = useMemo(() => {
    const fieldW = maxX - minX || 1
    const fieldH = maxY - minY || 1
    return Math.min(
      (canvasWidth  - PADDING * 2) / fieldW,
      (canvasHeight - PADDING * 2) / fieldH,
    )
  }, [minX, minY, maxX, maxY, canvasWidth, canvasHeight])

  const toCanvas = (geoX: number, geoY: number): [number, number] => [
    (geoX - minX) * scale + PADDING,
    canvasHeight - ((geoY - minY) * scale + PADDING),
  ]

  // Precompute draw items once per layout + canvas size
  const { items, treeColorMap } = useMemo(() => {
    const treeColorMap = buildTreeColorMap(layout.features)
    const items: DrawItem[] = []

    for (const feature of layout.features) {
      if (feature.geometry.type !== 'Polygon') continue
      const props = feature.properties as FeatureProps

      if (props.type === 'tree') {
        const [cx, cy] = toCanvas(props.center_x, props.center_y)
        const r = props.radius_m * scale
        const colors = treeColorMap.get(props.name ?? 'Unknown') ?? TREE_PALETTE[0]
        items.push({ kind: 'circle', props, cx, cy, r, baseColor: colors.base, hoverColor: colors.hover })
        continue
      }

      // Rect-based features: derive bbox from polygon coords
      const coords = (feature.geometry as Polygon).coordinates[0]
      if (coords.length < 4) continue
      let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity
      for (const [x, y] of coords) {
        if (x < gMinX) gMinX = x; if (y < gMinY) gMinY = y
        if (x > gMaxX) gMaxX = x; if (y > gMaxY) gMaxY = y
      }
      const [x1, y1] = toCanvas(gMinX, gMaxY)
      const [x2, y2] = toCanvas(gMaxX, gMinY)
      const w = x2 - x1, h = y2 - y1
      if (w <= 0 || h <= 0) continue

      const baseColor  = props.type === 'pv_row' ? COLORS.pv_row  : props.type === 'gap' ? COLORS.gap  : props.type === 'shadow' ? COLORS.shadow  : COLORS.plant_row
      const hoverColor = props.type === 'pv_row' ? COLORS.pv_row_hover : props.type === 'gap' ? COLORS.gap_hover : props.type === 'shadow' ? COLORS.shadow_hover : COLORS.plant_row_hover
      const opacity    = props.type === 'shadow' ? 0.08 : 0.9
      const strokeColor = props.type === 'gap' ? '#c9a84c22' : props.type === 'shadow' ? null : null
      const label = props.type === 'pv_row' && w > 40 ? `☀ ${props.kw} kW` : null

      items.push({ kind: 'rect', props, x: x1, y: y1, w, h, baseColor, hoverColor, opacity, strokeColor, label })
    }

    return { items, treeColorMap }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, canvasWidth, canvasHeight, scale, minX, minY])

  // Draw everything to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const hovered = i === hoveredIndex
      ctx.globalAlpha = item.kind === 'rect' ? item.opacity : 0.9

      if (item.kind === 'circle') {
        ctx.beginPath()
        ctx.arc(item.cx, item.cy, item.r, 0, Math.PI * 2)
        ctx.fillStyle = hovered ? item.hoverColor : item.baseColor
        ctx.fill()

      } else {
        ctx.fillStyle = hovered ? item.hoverColor : item.baseColor
        ctx.beginPath()
        ctx.roundRect(item.x, item.y, item.w, item.h, 2)
        ctx.fill()

        if (item.strokeColor) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = item.strokeColor
          ctx.lineWidth = 1
          ctx.stroke()
        }

        if (item.label) {
          ctx.globalAlpha = 1
          ctx.fillStyle = '#0a0a0a'
          ctx.font = '9px Inter, sans-serif'
          ctx.fillText(item.label, item.x + 4, item.y + item.h / 2 + 4)
        }
      }
    }

    ctx.globalAlpha = 1
  }, [items, hoveredIndex, canvasWidth, canvasHeight])

  // Hit-test on mousemove
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setMousePos({ x: mx, y: my })

    // Search in reverse so top-drawn shapes take priority
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (item.kind === 'circle') {
        if (Math.hypot(mx - item.cx, my - item.cy) <= item.r) { setHoveredIndex(i); return }
      } else {
        if (mx >= item.x && mx <= item.x + item.w && my >= item.y && my <= item.y + item.h) { setHoveredIndex(i); return }
      }
    }
    setHoveredIndex(null)
  }

  const handleMouseLeave = () => { setHoveredIndex(null); setMousePos(null) }

  // Tooltip content
  const hoveredItem = hoveredIndex !== null ? items[hoveredIndex] : null
  const lines = hoveredItem ? tooltipLines(hoveredItem.props, t) : []

  const PAD = 10, LINE_H = 16, TW = 180
  const TH = PAD * 2 + lines.length * LINE_H
  const tx = mousePos ? Math.min(mousePos.x + 14, canvasWidth - TW - 8) : 0
  const ty = mousePos ? Math.min(mousePos.y + 14, canvasHeight - TH - 8) : 0

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', cursor: hoveredItem ? 'pointer' : 'default' }}
      />

      {/* Tooltip overlay */}
      {hoveredItem && mousePos && (
        <div
          className="pointer-events-none absolute rounded-lg border border-[#c9a84c]/50 bg-[#1a1a1a]/95 px-3 py-2"
          style={{ left: tx, top: ty, minWidth: TW }}
        >
          {lines.map((line, i) => (
            <p key={i} className={`text-[11px] leading-4 ${i === 0 ? 'text-[#f0ece3]' : 'text-[#9a9080]'}`}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 flex-wrap">
        {[
          { color: COLORS.plant_row, label: t('summary.legend.plant_row'), round: false },
          { color: COLORS.pv_row,    label: t('summary.legend.pv_row'),    round: false },
          { color: COLORS.gap,       label: t('summary.legend.gap'),       round: false },
        ].map(({ color, label, round }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3 h-3 ${round ? 'rounded-full' : 'rounded-sm'}`} style={{ backgroundColor: color }} />
            <span className="text-xs text-[#9a9080]">{label}</span>
          </div>
        ))}
        {[...treeColorMap.entries()].map(([name, colors]) => (
          <div key={name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.base }} />
            <span className="text-xs text-[#9a9080]">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
