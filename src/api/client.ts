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
  MakeGardenLayoutRequest,
} from '../types'
import { Plant, type RawPlant } from '../models/Plant'
import { getToken } from './token'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface AuthUser { id: number; email: string }
export interface AuthResponse { token: string; user: AuthUser }

export function apiRegister(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
}
export function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

// ─── Gardens (saved layouts) ─────────────────────────────────────────────────
export interface SavedGarden {
  id: string; serial_no: number; name: string; mode: 'field' | 'garden'
  field_length: number; field_width: number; created_at: string | null
}
export interface PlantedPlant {
  serial: string; name: string; plant_id: number; x: number; y: number
  stage: string | null; health_status: string
}

export function saveGardenToAccount(name: string, jobId: string, mode: 'field' | 'garden') {
  return request<{ id: string; serial_no: number; planted_count: number; summary_only: boolean }>(
    '/gardens', { method: 'POST', body: JSON.stringify({ name, job_id: jobId, mode }) },
  )
}
export function listGardens(): Promise<SavedGarden[]> {
  return request<SavedGarden[]>('/gardens')
}
export function getGarden(id: string) {
  return request<SavedGarden & { layout_url: string | null }>(`/gardens/${id}`)
}
export function getGardenLayout(id: string): Promise<GardenLayout> {
  return request<GardenLayout>(`/gardens/${id}/layout`)
}
export function getSavedPdfUrl(id: string): Promise<string> {
  return request<{ url: string }>(`/gardens/${id}/pdf_url`).then((r) => r.url)
}
export function getGardenPlants(id: string) {
  return request<{ summary_only: boolean; plants: PlantedPlant[] }>(`/gardens/${id}/plants`)
}
export function renameGarden(id: string, name: string) {
  return request<{ id: string; name: string }>(`/gardens/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}
export function deleteGarden(id: string) {
  return request<{ deleted: boolean }>(`/gardens/${id}`, { method: 'DELETE' })
}

// ─── Garden docs (photos) ────────────────────────────────────────────────────
export interface PhotoGroup { date: string; photos: { id: string; url: string; caption: string | null }[] }

export async function uploadGardenPhoto(gardenId: string, file: File, takenOn?: string) {
  const fd = new FormData()
  fd.append('file', file)
  if (takenOn) fd.append('taken_on', takenOn)
  const token = getToken()
  const res = await fetch(`${BASE_URL}/gardens/${gardenId}/photos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},   // no Content-Type → browser sets multipart boundary
    body: fd,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<{ id: string; taken_on: string; url: string }>
}
export function listGardenPhotos(gardenId: string) {
  return request<{ dates: string[]; groups: PhotoGroup[] }>(`/gardens/${gardenId}/photos`)
}
export function updatePhotoDate(gardenId: string, photoId: string, takenOn: string) {
  return request<{ id: string; taken_on: string }>(
    `/gardens/${gardenId}/photos/${photoId}`, { method: 'PATCH', body: JSON.stringify({ taken_on: takenOn }) },
  )
}
export function deleteGardenPhoto(gardenId: string, photoId: string) {
  return request<{ deleted: boolean }>(`/gardens/${gardenId}/photos/${photoId}`, { method: 'DELETE' })
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
// by polling GET /job_status/<job_id> every 30s until status="done" or "failed".
// The done-result no longer contains a PDF — instead the result has a
// `pdf_path` referencing Supabase Storage. Downloads use getPdfUrl() (below)
// to mint a short-lived signed URL on demand.
const POLL_INTERVAL_MS = 30000
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

// ─── Garden Planner ────────────────────────────────────────────────────────
// The garden job streams: POST /generate_garden_layout returns 202 + { job_id }
// and GET /garden_job_status/<id> returns the geometry packed SO FAR (partial)
// on every poll while status="running", then the final result on "done". The
// caller renders each partial as it arrives, so the garden appears to grow live.
const GARDEN_POLL_INTERVAL_MS = 250

type GardenStatusResponse =
  | { status: 'queued' | 'running'; result: GardenLayout | null }
  | { status: 'done'; result: GardenLayout }
  | { status: 'failed'; error: string }

// POST /generate_garden_layout — kicks off the async job, returns its id.
export async function startGarden(
  body: MakeGardenLayoutRequest,
  signal?: AbortSignal,
): Promise<string> {
  const { job_id } = await request<{ job_id: string }>('/generate_garden_layout', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  })
  return job_id
}

// Poll the garden job, invoking onTick with each partial layout. Resolves with
// the final layout on "done", rejects on "failed"/abort/lost connection.
export function streamGarden(
  jobId: string,
  onTick: (partial: GardenLayout) => void,
  signal?: AbortSignal,
): Promise<GardenLayout> {
  return new Promise((resolve, reject) => {
    let consecutiveErrors = 0
    const intervalId = setInterval(async () => {
      if (signal?.aborted) {
        clearInterval(intervalId)
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      try {
        const res = await fetch(`${BASE_URL}/garden_job_status/${jobId}`, { signal })
        const data = (await res.json()) as GardenStatusResponse
        consecutiveErrors = 0
        if (data.status === 'failed') {
          clearInterval(intervalId)
          reject(new Error(data.error))
          return
        }
        if (data.result) onTick(data.result)          // partial OR final
        if (data.status === 'done') {
          clearInterval(intervalId)
          resolve(data.result)
        }
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
    }, GARDEN_POLL_INTERVAL_MS)
  })
}

// GET /garden_pdf_url/<jobId> — Supabase Storage signed URL for the garden PDF.
export async function getGardenPdfUrl(jobId: string): Promise<string> {
  const { url } = await request<{ url: string }>(`/garden_pdf_url/${jobId}`)
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
