/**
 * FieldCanvas — renders the GeoJSON garden layout on a plain HTML5 canvas.
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
import { speciesColor } from './speciesColor'
import { useAppearSchedule, appearKey } from './useAppearSchedule'

interface FieldCanvasProps {
  layout:        FeatureCollection
  canvasWidth:   number
  canvasHeight:  number
  hiddenSpecies?: ReadonlySet<string>
  /** Garden streaming: pop newly-arrived plants in with a staggered animation. */
  animateAppear?: boolean
}

// ─── Feature property types ───────────────────────────────────────────────────

interface PlantRowProps     { type: 'plant_row';      row_index: number }
interface PlantInstanceProps{ type: 'plant_instance'; plant_id?: number; plant_name: string; spread_m: number; radius_m: number; companion_names?: string[]; antagonist_names?: string[] }
interface TreeProps         { type: 'tree';           name: string; spread_m: number; height_m?: number }
interface PVRowProps        { type: 'pv_row';         row_index: number; kw: number }
interface GapProps          { type: 'gap' }
interface ShadowProps       { type: 'shadow';         row_index?: number; shadow_length_m?: number }

type RawProps = PlantRowProps | PlantInstanceProps | TreeProps | PVRowProps | GapProps | ShadowProps

// ─── Internal draw items ──────────────────────────────────────────────────────

interface RectItem {
  kind: 'rect'
  props: RawProps
  x: number; y: number; w: number; h: number
  baseColor: string; hoverColor: string
  opacity: number
  strokeColor: string | null
  label: string | null
}

interface CircleItem {
  kind: 'circle'
  props: RawProps
  cx: number; cy: number; r: number
  geoX: number; geoY: number
  baseColor: string; hoverColor: string
}

type DrawItem = RectItem | CircleItem

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = 32

const STRUCT = {
  plant_row: { base: '#1e3a28', hover: '#2a5038' },
  pv_row:    { base: '#c9a84c', hover: '#e0c068' },
  gap:       { base: '#2a1f0e', hover: '#3d2e14' },
  shadow:    { base: '#888888', hover: '#aaaaaa' },
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function polyBBox(coords: number[][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of coords) {
    if (x < minX) minX = x; if (y < minY) minY = y
    if (x > maxX) maxX = x; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

function polyCentroid(coords: number[][]): [number, number] {
  let sx = 0, sy = 0
  for (const [x, y] of coords) { sx += x; sy += y }
  return [sx / coords.length, sy / coords.length]
}

// Bounding box from Polygon features only (structural elements define field extent)
function computeBBox(fc: FeatureCollection) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of fc.features) {
    if (f.geometry.type !== 'Polygon') continue
    for (const ring of (f.geometry as Polygon).coordinates)
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (y < minY) minY = y
        if (x > maxX) maxX = x; if (y > maxY) maxY = y
      }
  }
  return { minX, minY, maxX, maxY }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function tooltipLines(item: DrawItem, t: (k: string, o?: Record<string, unknown>) => string): string[] {
  const p = item.props
  const geo = item.kind === 'circle'
    ? `X: ${item.geoX.toFixed(2)} m  Y: ${item.geoY.toFixed(2)} m`
    : null

  switch (p.type) {
    case 'plant_instance': {
      const lines = [p.plant_name, `Spread: ${p.spread_m} m`]
      if (geo) lines.push(geo)
      return lines
    }
    case 'tree': {
      const lines = [`🌳 ${p.name}`, `Spread: ${p.spread_m} m`]
      if (p.height_m != null) lines.push(`Height: ${p.height_m} m`)
      if (geo) lines.push(geo)
      return lines
    }
    case 'pv_row':
      return [t('summary.tooltip.pv_row', { index: p.row_index + 1, kw: p.kw })]
    case 'shadow':
      return p.shadow_length_m != null
        ? [`Shadow zone`, `Length: ${p.shadow_length_m.toFixed(1)} m`]
        : [`Shadow zone`]
    case 'gap':
      return [t('summary.tooltip.gap')]
    default:
      return [t('summary.tooltip.plant_row', { index: (p as PlantRowProps).row_index + 1 })]
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FieldCanvas({ layout, canvasWidth, canvasHeight, hiddenSpecies, animateAppear = false }: FieldCanvasProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [mousePos,   setMousePos]   = useState<{ x: number; y: number } | null>(null)

  // ── Zoom / pan ────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 })
  transformRef.current = { zoom, panX, panY }
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // ── Scale from Polygon bbox (structural features define the field extent) ─
  const { minX, minY, maxX, maxY } = useMemo(() => computeBBox(layout), [layout])
  const scale = useMemo(() => {
    const fw = maxX - minX || 1
    const fh = maxY - minY || 1
    return Math.min(
      (canvasWidth  - PADDING * 2) / fw,
      (canvasHeight - PADDING * 2) / fh,
    )
  }, [minX, minY, maxX, maxY, canvasWidth, canvasHeight])

  // Centre the rendered field in the canvas regardless of aspect-ratio mismatch
  const offX = (canvasWidth  - (maxX - minX) * scale) / 2
  const offY = (canvasHeight - (maxY - minY) * scale) / 2

  const toCanvas = (gx: number, gy: number): [number, number] => [
    (gx - minX) * scale + offX,
    canvasHeight - ((gy - minY) * scale + offY),
  ]

  // ── Non-passive wheel handler ─────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const { zoom, panX, panY } = transformRef.current
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const nz = Math.max(0.5, Math.min(12, zoom * factor))
      const ratio = nz / zoom
      setZoom(nz)
      setPanX(mx + (panX - mx) * ratio)
      setPanY(my + (panY - my) * ratio)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Pinch-to-zoom + two-finger pan (touch) ───────────────────────────────
  const touchRef = useRef<{ dist: number; midX: number; midY: number; panX: number; panY: number; zoom: number } | null>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const rect = el.getBoundingClientRect()
      touchRef.current = {
        dist: dist(a, b),
        midX: (a.clientX + b.clientX) / 2 - rect.left,
        midY: (a.clientY + b.clientY) / 2 - rect.top,
        panX: transformRef.current.panX,
        panY: transformRef.current.panY,
        zoom: transformRef.current.zoom,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !touchRef.current) return
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const rect = el.getBoundingClientRect()
      const curDist = dist(a, b)
      const curMidX = (a.clientX + b.clientX) / 2 - rect.left
      const curMidY = (a.clientY + b.clientY) / 2 - rect.top
      const t0 = touchRef.current

      // Zoom around the initial midpoint
      const scale = curDist / t0.dist
      const nz = Math.max(0.5, Math.min(12, t0.zoom * scale))
      const ratio = nz / t0.zoom

      // Pan: combine zoom-induced shift with finger-drag offset
      const nx = t0.midX + (t0.panX - t0.midX) * ratio + (curMidX - t0.midX)
      const ny = t0.midY + (t0.panY - t0.midY) * ratio + (curMidY - t0.midY)

      setZoom(nz)
      setPanX(nx)
      setPanY(ny)
    }

    const onTouchEnd = () => { touchRef.current = null }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  // ── Build draw items ──────────────────────────────────────────────────────
  const items = useMemo(() => {
    const rects:   RectItem[]   = []
    const circles: CircleItem[] = []

    for (const feature of layout.features) {
      const props = feature.properties as RawProps

      // ── MultiPoint → plant circles (current API) ────────────────────────
      if (feature.geometry.type === 'MultiPoint') {
        if (props.type !== 'plant_instance') continue
        if (hiddenSpecies?.has(props.plant_name)) continue
        const r = ((props as PlantInstanceProps).spread_m / 2) * scale
        const { base, hover } = speciesColor(props.plant_name)
        for (const [gx, gy] of (feature.geometry as import('geojson').MultiPoint).coordinates) {
          const [cx, cy] = toCanvas(gx, gy)
          circles.push({ kind: 'circle', props, cx, cy, r, geoX: gx, geoY: gy, baseColor: base, hoverColor: hover })
        }
        continue
      }

      // ── Point → plant circle (legacy) ───────────────────────────────────
      if (feature.geometry.type === 'Point') {
        if (props.type !== 'plant_instance') continue
        if (hiddenSpecies?.has(props.plant_name)) continue
        const [gx, gy] = (feature.geometry as import('geojson').Point).coordinates
        const r = ((props as PlantInstanceProps).spread_m / 2) * scale
        const { base, hover } = speciesColor(props.plant_name)
        const [cx, cy] = toCanvas(gx, gy)
        circles.push({ kind: 'circle', props, cx, cy, r, geoX: gx, geoY: gy, baseColor: base, hoverColor: hover })
        continue
      }

      if (feature.geometry.type !== 'Polygon') continue
      const coords = (feature.geometry as Polygon).coordinates[0]

      // ── Polygon plant_instance (legacy) ─────────────────────────────────
      if (props.type === 'plant_instance') {
        if (hiddenSpecies?.has(props.plant_name)) continue
        const [gx, gy] = polyCentroid(coords)
        const { minX: bx0, maxX: bx1 } = polyBBox(coords)
        const r = ((bx1 - bx0) / 2) * scale
        const { base, hover } = speciesColor(props.plant_name)
        const [cx, cy] = toCanvas(gx, gy)
        circles.push({ kind: 'circle', props, cx, cy, r, geoX: gx, geoY: gy, baseColor: base, hoverColor: hover })
        continue
      }

      // ── Tree circle ──────────────────────────────────────────────────────
      if (props.type === 'tree') {
        if (hiddenSpecies?.has(props.name)) continue
        const [gx, gy] = polyCentroid(coords)
        const { minX: bx0, maxX: bx1 } = polyBBox(coords)
        const r = ((bx1 - bx0) / 2) * scale
        const { base, hover } = speciesColor(props.name)
        const [cx, cy] = toCanvas(gx, gy)
        circles.push({ kind: 'circle', props, cx, cy, r, geoX: gx, geoY: gy, baseColor: base, hoverColor: hover })
        continue
      }

      // ── Rectangle features ───────────────────────────────────────────────
      const { minX: gx0, minY: gy0, maxX: gx1, maxY: gy1 } = polyBBox(coords)
      const [x1, y1] = toCanvas(gx0, gy1)  // top-left (north edge has high Y)
      const [x2, y2] = toCanvas(gx1, gy0)  // bottom-right
      const w = x2 - x1, h = y2 - y1
      if (w <= 0 || h <= 0) continue

      switch (props.type) {
        case 'plant_row':
          rects.push({ kind: 'rect', props, x: x1, y: y1, w, h,
            baseColor: STRUCT.plant_row.base, hoverColor: STRUCT.plant_row.hover,
            opacity: 0.6, strokeColor: null, label: null })
          break
        case 'pv_row':
          rects.push({ kind: 'rect', props, x: x1, y: y1, w, h,
            baseColor: STRUCT.pv_row.base, hoverColor: STRUCT.pv_row.hover,
            opacity: 0.9, strokeColor: null,
            label: w > 40 ? `☀ ${props.kw} kW` : null })
          break
        case 'gap':
          rects.push({ kind: 'rect', props, x: x1, y: y1, w, h,
            baseColor: STRUCT.gap.base, hoverColor: STRUCT.gap.hover,
            opacity: 0.9, strokeColor: '#c9a84c22', label: null })
          break
        case 'shadow':
          rects.push({ kind: 'rect', props, x: x1, y: y1, w, h,
            baseColor: STRUCT.shadow.base, hoverColor: STRUCT.shadow.hover,
            opacity: 0.08, strokeColor: null, label: null })
          break
      }
    }

    // Draw order: background structure → plants → PV panels (panels occlude plants below them)
    const pvRects = rects.filter(r => r.props.type === 'pv_row')
    const bgRects = rects.filter(r => r.props.type !== 'pv_row')
    return [...bgRects, ...circles, ...pvRects] as DrawItem[]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, canvasWidth, canvasHeight, scale, minX, minY, hiddenSpecies])

  // ── Companion / antagonist relations (garden flow only) ────────────────────
  // Embedded in each plant_instance feature by the garden backend. Empty for
  // field layouts → the hover effect falls back to plain single-item highlight.
  const { relations, hasRelations } = useMemo(() => {
    const rel = new Map<string, { companions: Set<string>; antagonists: Set<string> }>()
    let any = false
    for (const f of layout.features) {
      const p = f.properties as RawProps
      if (p?.type !== 'plant_instance') continue
      const pi = p as PlantInstanceProps
      const companions  = new Set(pi.companion_names ?? [])
      const antagonists = new Set(pi.antagonist_names ?? [])
      if (companions.size || antagonists.size) any = true
      rel.set(pi.plant_name, { companions, antagonists })
    }
    return { relations: rel, hasRelations: any }
  }, [layout])

  // Whether the layout has structural features — drives the bottom legend.
  // Garden layouts (plant circles only) have none, so the legend is hidden there.
  const hasStructure = useMemo(
    () => layout.features.some(f => {
      const tp = (f.properties as RawProps)?.type
      return tp === 'plant_row' || tp === 'pv_row' || tp === 'gap'
    }),
    [layout],
  )

  const speciesNameOf = (props: RawProps): string | null =>
    props.type === 'plant_instance' ? props.plant_name
      : props.type === 'tree' ? props.name
      : null

  const circleKeyOf = (item: CircleItem): string =>
    appearKey(speciesNameOf(item.props) ?? '', item.geoX, item.geoY)

  // ── Staggered appear animation for streamed plants ─────────────────────────
  // Ordered keys of plant/tree circles (grouped by species in the streamed
  // GeoJSON); the scheduler diffs these to find each poll's new plants.
  const circleKeys = useMemo(
    () => items.filter((it): it is CircleItem => it.kind === 'circle').map(circleKeyOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  )
  const { schedule, scale: appearScale, alpha: appearAlpha, anyActive } = useAppearSchedule(animateAppear)
  useEffect(() => { schedule(circleKeys) }, [circleKeys, schedule])

  // ── Draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const paint = (now: number) => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      ctx.fillStyle = '#0d0d0d'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      ctx.save()
      ctx.translate(panX, panY)
      ctx.scale(zoom, zoom)

      // Garden hover effect: when hovering a plant, its companions shine and its
      // antagonists blur/dim. Only active when companion data is embedded (garden).
      const hovItem = hoveredIdx !== null ? items[hoveredIdx] : null
      const hoveredSpecies = hovItem && hovItem.kind === 'circle' ? speciesNameOf(hovItem.props) : null
      const tiered = hasRelations && !!hoveredSpecies
      const rel = hoveredSpecies ? relations.get(hoveredSpecies) : undefined

      for (let i = 0; i < items.length; i++) {
        const item    = items[i]
        const hovered = i === hoveredIdx

        if (item.kind === 'circle') {
          const name = speciesNameOf(item.props)
          let baseAlpha = 0.75
          let fill  = item.baseColor
          let glow  = 0

          if (tiered && name) {
            if (rel?.companions.has(name))       { baseAlpha = 1.0;  fill = item.hoverColor; glow = 14 }  // companions shine
            else if (rel?.antagonists.has(name)) { baseAlpha = 0.12; fill = item.baseColor }              // antagonists dim
            else                                 { baseAlpha = 0.75; fill = item.baseColor }              // hovered species + neutral: unchanged
          } else if (hovered) {
            baseAlpha = 0.9
            fill  = item.hoverColor
          }

          // Appear animation: scale + fade newly-streamed plants in (staggered).
          let r = item.r
          let alpha = baseAlpha
          if (animateAppear) {
            const key = circleKeyOf(item)
            const p = appearScale(key, now)
            if (p <= 0) continue               // not yet appeared this frame
            r = item.r * p
            alpha = baseAlpha * appearAlpha(key, now)
          }

          ctx.beginPath()
          ctx.arc(item.cx, item.cy, r, 0, Math.PI * 2)
          ctx.globalAlpha = alpha
          ctx.fillStyle   = fill
          if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = fill }
          else      { ctx.shadowBlur = 0;    ctx.shadowColor = 'transparent' }
          ctx.fill()
          ctx.shadowBlur = 0

        } else {
          ctx.globalAlpha = item.opacity
          ctx.fillStyle   = hovered ? item.hoverColor : item.baseColor
          ctx.beginPath()
          ctx.roundRect(item.x, item.y, item.w, item.h, 2)
          ctx.fill()

          if (item.strokeColor) {
            ctx.globalAlpha = 1
            ctx.strokeStyle = item.strokeColor
            ctx.lineWidth   = 1
            ctx.stroke()
          }

          if (item.label) {
            ctx.globalAlpha  = 1
            ctx.fillStyle    = '#0a0a0a'
            ctx.font         = '9px Inter, sans-serif'
            ctx.textAlign    = 'left'
            ctx.textBaseline = 'alphabetic'
            ctx.fillText(item.label, item.x + 4, item.y + item.h / 2 + 4)
          }
        }
      }

      ctx.restore()
      ctx.globalAlpha  = 1
      ctx.shadowBlur   = 0
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    // Single static paint when idle; rAF loop while plants are popping in.
    let rafId = 0
    const loop = () => {
      const now = performance.now()
      paint(now)
      if (animateAppear && anyActive(now)) rafId = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, hoveredIdx, canvasWidth, canvasHeight, zoom, panX, panY, relations, hasRelations, animateAppear, appearScale, appearAlpha, anyActive])

  // ── Hit-test ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX - rect.left, startY: e.clientY - rect.top,
      startPanX: panX,               startPanY: panY,
    }
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (dragRef.current) {
      setPanX(dragRef.current.startPanX + (mx - dragRef.current.startX))
      setPanY(dragRef.current.startPanY + (my - dragRef.current.startY))
      return
    }

    setMousePos({ x: mx, y: my })
    const bx = (mx - panX) / zoom
    const by = (my - panY) / zoom
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (item.kind === 'circle') {
        if (Math.hypot(bx - item.cx, by - item.cy) <= item.r) { setHoveredIdx(i); return }
      } else {
        if (bx >= item.x && bx <= item.x + item.w && by >= item.y && by <= item.y + item.h) { setHoveredIdx(i); return }
      }
    }
    setHoveredIdx(null)
  }

  const handleMouseUp    = () => { dragRef.current = null; setIsDragging(false) }
  const handleMouseLeave = () => { dragRef.current = null; setIsDragging(false); setHoveredIdx(null); setMousePos(null) }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const hoveredItem = hoveredIdx !== null ? items[hoveredIdx] : null
  const lines = hoveredItem ? tooltipLines(hoveredItem, t) : []
  const PAD = 10, LINE_H = 16, TW = 200
  const TH  = PAD * 2 + lines.length * LINE_H
  const tx  = mousePos ? Math.min(mousePos.x + 14, canvasWidth  - TW - 8) : 0
  const ty  = mousePos ? Math.min(mousePos.y + 14, canvasHeight - TH - 8) : 0

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'block',
          cursor: isDragging ? 'grabbing' : hoveredItem ? 'pointer' : 'grab',
          touchAction: 'none',
        }}
      />

      {zoom !== 1 && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[#1a1a1a]/90 border border-white/10 text-[10px] text-[#9a9080] tabular-nums pointer-events-none">
          {zoom.toFixed(1)}×
        </div>
      )}

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

      {hasStructure && (
        <div className="mt-4 flex items-center gap-6 flex-wrap">
          {([
            ['plant_row', t('summary.legend.plant_row')],
            ['pv_row',    t('summary.legend.pv_row')],
            ['gap',       t('summary.legend.gap')],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STRUCT[key].base }} />
              <span className="text-xs text-[#9a9080]">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
