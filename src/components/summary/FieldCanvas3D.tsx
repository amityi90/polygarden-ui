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
import { useEffect, useMemo, useRef } from 'react'
import type { Polygon, Point, MultiPoint } from 'geojson'
import { useGardenStore } from '../../store/gardenStore'
import { speciesColor } from './speciesColor'
import type { SpeciesEntry } from './SpeciesLegend'

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
  sides = 12,
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
}

export function FieldCanvas3D({ hiddenSpecies, speciesList }: FieldCanvas3DProps) {
  const { gardenLayout, field } = useGardenStore()
  const plotRef = useRef<HTMLDivElement>(null)

  const traces = useMemo(() => {
    if (!gardenLayout || !field) return []
    const features = gardenLayout.features
    const out: object[] = []

    // 1 ── Ground plane ────────────────────────────────────────────────────────
    out.push({
      type: 'mesh3d',
      x: [0, field.length, field.length, 0],
      y: [0, 0, field.width, field.width],
      z: [0, 0, 0, 0],
      i: [0, 0], j: [1, 2], k: [2, 3],
      color: '#121f12', opacity: 1,
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
        const s = ensureSpecies(p.plant_name as string, spread, height)
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
      const r       = spread_m / 2
      const entry   = entryByName.get(name)
      const specMesh = emptyMesh()
      const texts:   string[] = []

      for (let p = 0; p < x.length; p++) {
        const lines = [`<b>${name}</b>`, `Spread: ${spread_m} m`]
        if (entry?.heightLabel)      lines.push(`Height: ${entry.heightLabel}`)
        if (entry?.plantingSeason)   lines.push(`Plant: ${entry.plantingSeason}`)
        if (entry?.harvestingSeason) lines.push(`Harvest: ${entry.harvestingSeason}`)
        if (entry?.count != null)    lines.push(`In field: ${entry.count}`)
        lines.push(`X: ${x[p].toFixed(2)} m  Y: ${y[p].toFixed(2)} m`)
        addCone(specMesh, x[p], y[p], height_m, r, texts, lines.join('<br>'))
      }

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

        for (let p = 0; p < x.length; p++) {
          const lines = [`<b>${name}</b>`, `Spread: ${(r * 2).toFixed(1)} m`, `Height: ${height.toFixed(1)} m`]
          if (entry?.plantingSeason)   lines.push(`Plant: ${entry.plantingSeason}`)
          if (entry?.harvestingSeason) lines.push(`Harvest: ${entry.harvestingSeason}`)
          if (entry?.count != null)    lines.push(`In field: ${entry.count}`)
          lines.push(`X: ${x[p].toFixed(2)} m  Y: ${y[p].toFixed(2)} m`)
          addCone(treeMesh, x[p], y[p], height, r, texts, lines.join('<br>'), 12)
        }

        out.push({
          type: 'mesh3d', ...treeMesh,
          text: texts,
          color: speciesColor(name).base, opacity: 0.9,
          name, hovertemplate: '%{text}<extra></extra>', showlegend: true,
        })
      }
    }

    return out
  }, [gardenLayout, field, hiddenSpecies])

  useEffect(() => {
    const el = plotRef.current
    if (!el || traces.length === 0) return

    Plotly.newPlot(el, traces, {
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      paper_bgcolor: '#0d0d0d',
      scene: {
        xaxis: { title: 'X (m)', showgrid: true, gridcolor: '#252525', zeroline: false, color: '#6b6358' },
        yaxis: { title: 'Y (m)', showgrid: true, gridcolor: '#252525', zeroline: false, color: '#6b6358' },
        zaxis: { title: 'Height (m)', showgrid: false, zeroline: false, color: '#6b6358', range: [-0.3, 12] },
        aspectmode: 'data',
        bgcolor: '#0d0d0d',
        camera: { eye: { x: 1.5, y: -1.5, z: 0.9 } },
      },
      showlegend: false,
    }, { displayModeBar: false, responsive: true })

    return () => { Plotly.purge(el) }
  }, [traces])

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

  return <div ref={plotRef} className="w-full h-[560px]" />
}
