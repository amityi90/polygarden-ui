/**
 * FieldCanvas3D — renders the garden layout as an interactive 3D scene.
 *
 * Uses plotly.js-dist-min (the smallest Plotly bundle, WebGL-backed scatter3d)
 * for smooth rendering. Key performance strategy: one trace per species group,
 * not one trace per plant — so a 5000-plant field is still only ~15 traces.
 *
 * Layers (bottom → top):
 *   z=0          ground plane, plant rows, tractor gaps
 *   z=0.02        shadow zones (semi-transparent)
 *   z=0→height   plants as inverted cones (tip at ground, wide top at height_m / spread_m)
 *   z=0→height   trees as inverted cones (tip at ground, wide top at height_m)
 *   z=3.6–4      PV panels (sloped)
 */

// @ts-ignore — plotly.js-dist-min ships without TypeScript declarations
import Plotly from 'plotly.js-dist-min'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Polygon, Point, MultiPoint } from 'geojson'
import { useGardenStore } from '../../store/gardenStore'
import { speciesColor } from './speciesColor'
import type { SpeciesEntry } from './SpeciesLegend'

// ─── Tiny 3-vector helpers (camera math for touch pan/zoom) ────────────────────
type V3 = { x: number; y: number; z: number }
const sub    = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const add    = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const scaleV = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })
const cross  = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const vlen   = (a: V3): number => Math.hypot(a.x, a.y, a.z)
const norm   = (a: V3): V3 => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l } }

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

// Accumulator for combining many quads into one mesh3d trace
interface MeshAcc { x: number[]; y: number[]; z: number[]; i: number[]; j: number[]; k: number[] }

function emptyMesh(): MeshAcc { return { x: [], y: [], z: [], i: [], j: [], k: [] } }

function addFlatQuad(m: MeshAcc, x0: number, y0: number, x1: number, y1: number, z: number) {
  const b = m.x.length
  m.x.push(x0, x1, x1, x0)
  m.y.push(y0, y0, y1, y1)
  m.z.push(z,  z,  z,  z )
  m.i.push(b, b); m.j.push(b + 1, b + 2); m.k.push(b + 2, b + 3)
}

function meshTrace(m: MeshAcc, color: string, opacity: number, name: string, legend: boolean) {
  return { type: 'mesh3d', ...m, color, opacity, hoverinfo: 'skip', name, showlegend: legend }
}

// Cone facets: high enough that the top disc reads as a circle, not a polygon.
// Lower it if a very dense garden loads slowly (geometry is static now that the
// hover restyle is removed).
const CONE_SIDES = 16

/**
 * Add an inverted cone to a mesh accumulator.
 *   - Apex (tip) at (cx, cy, 0)     — narrow base on the ground
 *   - Top disc at (cx, cy, height)  — wide canopy at plant height
 * 12 sides gives a smooth silhouette and costs only 14 vertices + 24 triangles per plant.
 *
 * `texts` / `hoverText`: every vertex of this cone gets `hoverText` appended to `texts`
 * so Plotly shows the same tooltip wherever on the cone the cursor lands.
 */
function addCone(
  m: MeshAcc,
  cx: number, cy: number,
  height: number, r: number,
  texts: string[], hoverText: string,
  sides = CONE_SIDES,
) {
  const base = m.x.length
  const vertexCount = 2 + sides
  // vertex 0: apex at ground level
  m.x.push(cx); m.y.push(cy); m.z.push(0)
  // vertex 1: top-disc centre
  m.x.push(cx); m.y.push(cy); m.z.push(height)
  // vertices 2 … sides+1: top-disc perimeter
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2
    m.x.push(cx + r * Math.cos(a))
    m.y.push(cy + r * Math.sin(a))
    m.z.push(height)
  }
  for (let k = 0; k < sides; k++) {
    const cur  = base + 2 + k
    const next = base + 2 + (k + 1) % sides
    m.i.push(base);     m.j.push(cur);  m.k.push(next)
    m.i.push(base + 1); m.j.push(cur);  m.k.push(next)
  }
  // Stamp every vertex of this cone with the same hover text
  for (let v = 0; v < vertexCount; v++) texts.push(hoverText)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FieldCanvas3DProps {
  hiddenSpecies?: ReadonlySet<string>
  speciesList?:   SpeciesEntry[]
  /** Garden streaming: reveal newly-arrived cones in staggered waves. */
  animateAppear?: boolean
}

interface Relation { companions: Set<string>; antagonists: Set<string> }
interface SpeciesTrace { index: number; name: string; opacity: number }

const PLOT_CONFIG = { displayModeBar: false, responsive: true, scrollZoom: true }
const AXIS_BASE = { showgrid: true, gridcolor: '#1c241c', zeroline: false, color: '#5f6b58', showspikes: false }
const SCENE = {
  aspectmode: 'data',
  bgcolor: '#0b0f0b',
  uirevision: 'garden',   // keep the user's camera across react() updates while streaming
}

// Layout. Camera is set only on the first plot; react() omits it and the
// constant uirevision makes Plotly preserve the user's rotation/zoom/pan.
// Everything is drawn to scale (aspectmode 'data'); `unit` only labels the axes
// (cm for the garden, m for the field) and `zMax` fits the z-axis to the tallest
// cone so plants aren't lost in a tall empty box.
function plotLayout(withCamera: boolean, zMax: number, unit: string) {
  const scene: Record<string, unknown> = {
    ...SCENE,
    xaxis: { ...AXIS_BASE, title: `X (${unit})` },
    yaxis: { ...AXIS_BASE, title: `Y (${unit})` },
    zaxis: { title: `Height (${unit})`, showgrid: false, zeroline: false, color: '#5f6b58', showspikes: false, range: [-zMax * 0.03, zMax] },
  }
  if (withCamera) scene.camera = { eye: { x: 1.5, y: -1.55, z: 0.75 } }
  return {
    autosize: true, margin: { l: 0, r: 0, b: 0, t: 0 }, paper_bgcolor: '#0b0f0b',
    scene, showlegend: false, uirevision: 'garden',
  }
}

export function FieldCanvas3D({ hiddenSpecies, speciesList }: FieldCanvas3DProps) {
  const { gardenLayout, field } = useGardenStore()
  const plotRef = useRef<HTMLDivElement>(null)

  // Build the full Plotly trace set from the current layout.
  const buildTraces = useCallback(() => {
    if (!gardenLayout || !field) {
      return { traces: [] as object[], speciesTraces: [] as SpeciesTrace[], relByName: new Map<string, Relation>(), hasRelations: false, zMax: 12, unit: 'm' }
    }
    const features = gardenLayout.features
    // A garden has only plant_instance + garden_bounds (no rows/PV/shadow/trees).
    // Render the garden to scale in cm so axis numbers match plant sizes
    // (15–200 cm); the field planner stays in metres (UNIT = 1).
    const isGarden = !features.some((f) => {
      const tp = (f.properties as Record<string, unknown>)?.type as string | undefined
      return tp === 'plant_row' || tp === 'pv_row' || tp === 'gap' || tp === 'shadow' || tp === 'tree'
    })
    const UNIT = isGarden ? 100 : 1
    const unit = isGarden ? 'cm' : 'm'
    const out: object[] = []
    // Per-species cone traces (index in `out`, name, base opacity) + relations,
    // used for the companion-shine / antagonist-blur hover effect.
    const speciesTraces: SpeciesTrace[] = []
    const relByName = new Map<string, Relation>()
    let hasRelations = false
    const captureRel = (name: string, p: Record<string, unknown>) => {
      if (relByName.has(name)) return
      const companions  = new Set((p.companion_names  as string[]) ?? [])
      const antagonists = new Set((p.antagonist_names as string[]) ?? [])
      if (companions.size || antagonists.size) hasRelations = true
      relByName.set(name, { companions, antagonists })
    }

    // 1 ── Ground plane (soft soil) ──────────────────────────────────────────────
    out.push({
      type: 'mesh3d',
      x: [0, field.length * UNIT, field.length * UNIT, 0],
      y: [0, 0, field.width * UNIT, field.width * UNIT],
      z: [0, 0, 0, 0],
      i: [0, 0], j: [1, 2], k: [2, 3],
      color: '#16241a', opacity: 0.92, flatshading: true,
      hoverinfo: 'skip', showlegend: false,
    })

    // 2 ── Structural mesh accumulators ───────────────────────────────────────
    const plantRowMesh = emptyMesh()
    const gapMesh      = emptyMesh()
    const shadowMesh   = emptyMesh()
    const pvMesh       = emptyMesh()

    // 3 ── Plant species groups ───────────────────────────────────────────────
    const bySpecies = new Map<string, { x: number[]; y: number[]; spread_m: number; height_m: number }>()

    const ensureSpecies = (name: string, spread_m: number, height_m: number) => {
      if (!bySpecies.has(name)) bySpecies.set(name, { x: [], y: [], spread_m, height_m })
      return bySpecies.get(name)!
    }

    // 4 ── Trees (tracked just to know if any exist) ──────────────────────────
    let hasTree = false

    // ── Main feature loop ────────────────────────────────────────────────────
    for (const f of features) {
      const p = f.properties as Record<string, unknown>
      if (!p) continue

      // MultiPoint geometry → plant_instance (current API)
      if (f.geometry.type === 'MultiPoint') {
        if (p.type !== 'plant_instance') continue
        if (hiddenSpecies?.has(p.plant_name as string)) continue
        const spread = (p.spread_m as number) ?? 0.3
        const height = (p.height_m as number) ?? spread
        const name = p.plant_name as string
        const s = ensureSpecies(name, spread, height)
        captureRel(name, p)
        for (const [x, y] of (f.geometry as MultiPoint).coordinates) {
          s.x.push(x); s.y.push(y)
        }
        continue
      }

      // Point geometry → plant_instance (legacy)
      if (f.geometry.type === 'Point') {
        if (p.type !== 'plant_instance') continue
        if (hiddenSpecies?.has(p.plant_name as string)) continue
        const [x, y] = (f.geometry as Point).coordinates
        const spread = (p.spread_m as number) ?? 0.3
        const height = (p.height_m as number) ?? spread
        const s = ensureSpecies(p.plant_name as string, spread, height)
        captureRel(p.plant_name as string, p)
        s.x.push(x); s.y.push(y)
        continue
      }

      if (f.geometry.type !== 'Polygon') continue
      const coords = (f.geometry as Polygon).coordinates[0]
      const { minX, minY, maxX, maxY } = polyBBox(coords)

      switch (p.type) {
        case 'plant_row':
          addFlatQuad(plantRowMesh, minX, minY, maxX, maxY, 0)
          break

        case 'gap':
          addFlatQuad(gapMesh, minX, minY, maxX, maxY, 0)
          break

        case 'shadow':
          addFlatQuad(shadowMesh, minX, minY, maxX, maxY, 0.02)
          break

        case 'pv_row': {
          // Sloped panel: south edge (minY) at 4 m, north edge (maxY) at 3.6 m
          const b = pvMesh.x.length
          pvMesh.x.push(minX, maxX, maxX, minX)
          pvMesh.y.push(minY, minY, maxY, maxY)
          pvMesh.z.push(4, 4, 3.6, 3.6)
          pvMesh.i.push(b, b); pvMesh.j.push(b + 1, b + 2); pvMesh.k.push(b + 2, b + 3)
          break
        }

        case 'tree':
          hasTree = true
          break

        case 'plant_instance': {
          // Legacy Polygon plant_instance
          if (hiddenSpecies?.has(p.plant_name as string)) break
          const [cx, cy] = polyCentroid(coords)
          const spread = (p.spread_m as number) ?? 0.3
          const height = (p.height_m as number) ?? spread
          const s = ensureSpecies(p.plant_name as string, spread, height)
          captureRel(p.plant_name as string, p)
          s.x.push(cx); s.y.push(cy)
          break
        }
      }
    }

    // ── Emit structural meshes ───────────────────────────────────────────────
    if (plantRowMesh.x.length) out.push(meshTrace(plantRowMesh, '#1e3a28', 0.85, 'Plant rows',    true))
    if (gapMesh.x.length)      out.push(meshTrace(gapMesh,      '#3d2a10', 0.90, 'Tractor paths', true))
    if (shadowMesh.x.length)   out.push(meshTrace(shadowMesh,   '#888888', 0.12, 'Shadow zones',  true))
    if (pvMesh.x.length)       out.push(meshTrace(pvMesh,       '#1e3a5f', 1,    'PV Panels',     true))

    // Build a name → SpeciesEntry lookup for tooltip enrichment
    const entryByName = new Map((speciesList ?? []).map(e => [e.name, e]))

    // ── Emit one inverted-cone per plant, grouped by species ─────────────────
    for (const [name, { x, y, spread_m, height_m }] of bySpecies) {
      const color   = speciesColor(name).base
      const r       = (spread_m / 2) * UNIT
      const h       = height_m * UNIT
      const entry   = entryByName.get(name)
      const specMesh = emptyMesh()
      const texts:   string[] = []

      // One tooltip per species, reused by reference for every cone vertex —
      // avoids building ~N×sides distinct strings (a key memory saving).
      const tip = [`<b>${name}</b>`, `Spread: ${Math.round(spread_m * 100)} cm`]
      if (entry?.plantingSeason)   tip.push(`Plant: ${entry.plantingSeason}`)
      if (entry?.harvestingSeason) tip.push(`Harvest: ${entry.harvestingSeason}`)
      const hoverText = tip.join('<br>')
      for (let p = 0; p < x.length; p++) {
        addCone(specMesh, x[p] * UNIT, y[p] * UNIT, h, r, texts, hoverText)
      }

      speciesTraces.push({ index: out.length, name, opacity: 0.85 })
      out.push({
        type: 'mesh3d', ...specMesh,
        text: texts,
        color, opacity: 0.85,
        name, hovertemplate: '%{text}<extra></extra>', showlegend: true,
      })
    }

    // ── Emit trees as inverted cones ──────────────────────────────────────────
    if (hasTree) {
      const byTreeSpecies = new Map<string, { x: number[]; y: number[]; r: number; height: number }>()
      for (const f of features) {
        const p = f.properties as Record<string, unknown>
        if (p?.type !== 'tree' || f.geometry.type !== 'Polygon') continue
        const coords = (f.geometry as Polygon).coordinates[0]
        const [cx, cy] = polyCentroid(coords)
        const height = (p.height_m as number) ?? ((p.spread_m as number) ?? 2) * 2
        const r      = ((p.spread_m as number) ?? 1) / 2
        const name   = p.name as string
        if (!byTreeSpecies.has(name)) byTreeSpecies.set(name, { x: [], y: [], r, height })
        const e = byTreeSpecies.get(name)!
        e.x.push(cx); e.y.push(cy)
      }

      for (const [name, { x, y, r, height }] of byTreeSpecies) {
        const entry    = entryByName.get(name)
        const treeMesh = emptyMesh()
        const texts:   string[] = []

        const tip = [`<b>${name}</b>`, `Spread: ${(r * 2).toFixed(1)} m`, `Height: ${height.toFixed(1)} m`]
        if (entry?.plantingSeason)   tip.push(`Plant: ${entry.plantingSeason}`)
        if (entry?.harvestingSeason) tip.push(`Harvest: ${entry.harvestingSeason}`)
        const hoverText = tip.join('<br>')
        for (let p = 0; p < x.length; p++) {
          addCone(treeMesh, x[p], y[p], height, r, texts, hoverText, CONE_SIDES)
        }

        speciesTraces.push({ index: out.length, name, opacity: 0.9 })
        out.push({
          type: 'mesh3d', ...treeMesh,
          text: texts,
          color: speciesColor(name).base, opacity: 0.9,
          name, hovertemplate: '%{text}<extra></extra>', showlegend: true,
        })
      }
    }

    // Fit the z-axis (in the rendered unit) to the tallest cone so garden plants
    // aren't lost in a tall empty box; the field planner keeps 12 m headroom.
    let maxH = 0
    for (const s of bySpecies.values()) maxH = Math.max(maxH, s.height_m)
    const zMax = isGarden ? Math.max(maxH * UNIT * 1.15, UNIT) : 12

    return { traces: out, speciesTraces, relByName, hasRelations, zMax, unit }
  }, [gardenLayout, field, hiddenSpecies, speciesList])

  const { traces, zMax, unit } = useMemo(() => buildTraces(), [buildTraces])

  // Plot once, then update IN PLACE on every traces change (≈ one per streaming
  // poll). newPlot on first mount sets the camera; react() preserves the user's
  // rotation/zoom/pan via the constant uirevision. No per-hover restyle — the
  // native tooltip handles hover; a restyle on every mouse-move re-renders the
  // whole mesh and crashed dense gardens, so it's removed.
  const plottedRef = useRef(false)
  useEffect(() => {
    const el = plotRef.current
    if (!el || traces.length === 0) return
    if (!plottedRef.current) {
      Plotly.newPlot(el, traces, plotLayout(true, zMax, unit), PLOT_CONFIG)
      plottedRef.current = true
    } else {
      Plotly.react(el, traces, plotLayout(false, zMax, unit), PLOT_CONFIG)
    }
  }, [traces, zMax, unit])

  // Purge Plotly on unmount (we don't purge per update).
  useEffect(() => {
    const el = plotRef.current
    return () => { if (el) { try { Plotly.purge(el) } catch { /* already gone */ } } }
  }, [])

  // Touch interaction (attached once): ONE finger rotates (Plotly's default 3D
  // orbit — we don't preventDefault single-finger), TWO fingers pan (drag the
  // scene under the fingers) AND pinch-zoom, by moving the camera eye/center.
  useEffect(() => {
    const el = plotRef.current
    if (!el) return

    const FALLBACK = { eye: { x: 1.5, y: -1.5, z: 0.9 }, center: { x: 0, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } }
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const mid  = (a: Touch, b: Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 })

    let active = false
    let startDist = 0
    let startMid = { x: 0, y: 0 }
    let startEye: V3 = FALLBACK.eye
    let startCenter: V3 = FALLBACK.center
    let up: V3 = FALLBACK.up

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) { active = false; return }   // 1 finger → Plotly rotates
      e.preventDefault()
      active = true
      startDist = dist(e.touches[0], e.touches[1])
      startMid  = mid(e.touches[0], e.touches[1])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cam = (el as any)._fullLayout?.scene?.camera
      startEye    = cam?.eye    ? { ...cam.eye }    : { ...FALLBACK.eye }
      startCenter = cam?.center ? { ...cam.center } : { ...FALLBACK.center }
      up          = cam?.up     ? { ...cam.up }     : { ...FALLBACK.up }
    }

    const onMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 2) return
      e.preventDefault()
      const d = dist(e.touches[0], e.touches[1])
      const m = mid(e.touches[0], e.touches[1])

      // Camera basis from the gesture-start orientation.
      const fwd    = norm(sub(startCenter, startEye))
      const right  = norm(cross(fwd, up))
      const trueUp = norm(cross(right, fwd))
      const eyeDist = vlen(sub(startEye, startCenter))
      const rect = el.getBoundingClientRect()
      const k = eyeDist / Math.max(rect.height, 1)   // world units per screen pixel

      // Pan: move scene under the fingers (screen midpoint delta → world).
      const pan = add(scaleV(right, -(m.x - startMid.x) * k), scaleV(trueUp, (m.y - startMid.y) * k))
      // Zoom: scale eye toward/away from the (panned) center.
      const scale = d > 0 ? Math.max(0.2, Math.min(5, startDist / d)) : 1
      const newCenter = add(startCenter, pan)
      const newEye = add(newCenter, scaleV(sub(startEye, startCenter), scale))

      Plotly.relayout(el, { 'scene.camera.eye': newEye, 'scene.camera.center': newCenter })
    }
    const onEnd = () => { active = false }

    el.addEventListener('touchstart',  onStart, { passive: false })
    el.addEventListener('touchmove',   onMove,  { passive: false })
    el.addEventListener('touchend',    onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart',  onStart)
      el.removeEventListener('touchmove',   onMove)
      el.removeEventListener('touchend',    onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (!field) {
    return (
      <div className="w-full h-[560px] flex items-center justify-center text-[#9a9080] text-sm">
        Configure field dimensions first.
      </div>
    )
  }

  if (traces.length === 0) {
    return (
      <div className="w-full h-[560px] flex items-center justify-center text-[#9a9080] text-sm">
        Building 3D scene…
      </div>
    )
  }

  return <div ref={plotRef} className="w-full h-[560px]" style={{ touchAction: 'none' }} />
}
