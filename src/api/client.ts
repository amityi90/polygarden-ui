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

// POST /generate_field_layout
// The response is a GeoJSON FeatureCollection with an extra `pdf_base64` field.
// We strip the PDF out before returning the layout so it doesn't bloat the store.
export async function makeAgrivoltaicGarden(
  body: MakeGardenRequest,
): Promise<{ layout: GardenLayout; pdfBase64: string | null }> {
  const raw = await request<Record<string, unknown>>('/generate_field_layout', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  console.log('[makeAgrivoltaicGarden] response keys:', Object.keys(raw))
  console.log('[makeAgrivoltaicGarden] pdf_base64 type:', typeof raw['pdf_base64'], '| value (first 60):', typeof raw['pdf_base64'] === 'string' ? (raw['pdf_base64'] as string).slice(0, 60) : raw['pdf_base64'])
  const pdfBase64 = typeof raw['pdf_base64'] === 'string' ? raw['pdf_base64'] : null
  delete raw['pdf_base64']
  return { layout: raw as unknown as GardenLayout, pdfBase64 }
}
