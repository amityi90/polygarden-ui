/**
 * API client — all requests go to localhost:5000.
 *
 * Why a dedicated client module?
 * ─────────────────────────────
 * Centralising fetch calls here means:
 *  1. One place to swap the base URL (e.g. env variable in production).
 *  2. One place to add auth headers later.
 *  3. Every component gets typed responses without knowing about fetch.
 */

import type {
  PVRange,
  GardenLayout,
  CalculateMinMaxPVRequest,
  MakeGardenRequest,
} from '../types'
import { Plant, type RawPlant } from '../models/Plant'

const BASE_URL = 'http://localhost:5000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// GET /all_plants
export async function getAllPlants(): Promise<Plant[]> {
  const raw = await request<RawPlant[]>('/all_plants')
  return raw.map((r) => new Plant(r))
}

// POST /calculate_min_max_pv
export function calculateMinMaxPV(body: CalculateMinMaxPVRequest): Promise<PVRange> {
  return request<PVRange>('/calculate_min_max_pv', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// POST /generate_layout_pdf — triggers a browser download of the PDF
export async function downloadLayoutPdf(body: MakeGardenRequest): Promise<void> {
  const res = await fetch(`${BASE_URL}/generate_layout_pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PDF error ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'garden_layout.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

// POST /generate_field_layout
export async function makeAgrivoltaicGarden(body: MakeGardenRequest): Promise<GardenLayout> {
  const raw = await request<unknown>('/generate_field_layout', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  console.log('[generate_field_layout] raw response:', raw)
  return raw as GardenLayout
}
