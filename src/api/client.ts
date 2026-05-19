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

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

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
// The endpoint is async: POST returns 202 + { job_id }; the result is fetched
// by polling GET /job_status/<job_id> every 2s until status="done" or "failed".
// The done-result no longer contains a PDF — instead the result has a
// `pdf_path` referencing Supabase Storage. Downloads use getPdfUrl() (below)
// to mint a short-lived signed URL on demand.
const POLL_INTERVAL_MS = 2000
const MAX_CONSECUTIVE_ERRORS = 5

type JobStatusResponse =
  | { status: 'queued' | 'running' }
  | { status: 'done'; result: Record<string, unknown> }
  | { status: 'failed'; error: string }

export async function makeAgrivoltaicGarden(
  body: MakeGardenRequest,
  signal?: AbortSignal,
): Promise<{ layout: GardenLayout; jobId: string }> {
  const { job_id } = await request<{ job_id: string }>('/generate_field_layout', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  })

  const result = await pollJob(job_id, signal)
  return { layout: result as unknown as GardenLayout, jobId: job_id }
}

// GET /job_pdf_url/<jobId> — returns a Supabase Storage signed URL (30-min TTL).
export async function getPdfUrl(jobId: string): Promise<string> {
  const { url } = await request<{ url: string }>(`/job_pdf_url/${jobId}`)
  return url
}

function pollJob(jobId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let consecutiveErrors = 0
    const intervalId = setInterval(async () => {
      if (signal?.aborted) {
        clearInterval(intervalId)
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      try {
        const res = await fetch(`${BASE_URL}/job_status/${jobId}`, { signal })
        const data = (await res.json()) as JobStatusResponse
        consecutiveErrors = 0
        if (data.status === 'done')   { clearInterval(intervalId); resolve(data.result) }
        if (data.status === 'failed') { clearInterval(intervalId); reject(new Error(data.error)) }
        // queued / running → keep polling
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') {
          clearInterval(intervalId)
          reject(err)
          return
        }
        consecutiveErrors += 1
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(intervalId)
          reject(new Error('lost_connection'))
        }
      }
    }, POLL_INTERVAL_MS)
  })
}
