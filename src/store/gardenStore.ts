/**
 * Zustand store — global state for the entire wizard.
 *
 * Why Zustand?
 * ────────────
 * The wizard has 3 steps but they're separate components. We need to remember
 * what the user filled in step 1 when they're on step 3. Zustand is a tiny
 * (~1 KB) state manager that works without boilerplate (no actions, reducers,
 * or providers). You just call `useGardenStore()` in any component and read or
 * update the state directly. Think of it as a shared useState across components.
 *
 * Why persist middleware?
 * ──────────────────────
 * `persist` wraps the store and calls localStorage.setItem on every state
 * change, and localStorage.getItem on startup. The user's form data survives
 * page refreshes and browser restarts with zero extra code in any component.
 *
 * We exclude `allPlants` from persistence: Plant class instances don't survive
 * JSON round-trips (methods are lost). They're always re-fetched from the API,
 * so there's no value in storing them.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import type { FieldDimensions, PVRange, PVSystemConfig, GardenLayout, WizardStep } from '../types'
import type { Plant } from '../models/Plant'

// ── Split persistence: each planner lives in its own localStorage entry ───────
// The store stays single, but its persisted fields are routed to two physical
// keys so the field and garden planners are independent (filled/cleared without
// touching each other). The garden-form fields go to one key; everything else
// (field dims, plant selection, PV) goes to the other.
const FIELD_STORAGE_KEY  = 'polygarden-field'
const GARDEN_STORAGE_KEY = 'polygarden-garden'
const LEGACY_STORAGE_KEY = 'polygarden-wizard'
const GARDEN_KEYS = ['gardenField', 'gardenSelectedPlantIds', 'gardenStep']

const splitStorage: StateStorage = {
  getItem: () => {
    try {
      const f = localStorage.getItem(FIELD_STORAGE_KEY)
      const g = localStorage.getItem(GARDEN_STORAGE_KEY)
      if (!f && !g) {
        // One-time migration: fall back to the pre-split combined entry.
        return localStorage.getItem(LEGACY_STORAGE_KEY)
      }
      const fp = f ? JSON.parse(f) : { state: {}, version: 0 }
      const gp = g ? JSON.parse(g) : { state: {}, version: 0 }
      return JSON.stringify({
        state: { ...fp.state, ...gp.state },
        version: fp.version ?? gp.version ?? 0,
      })
    } catch {
      return null
    }
  },
  setItem: (_name, value) => {
    try {
      const { state, version } = JSON.parse(value as string)
      const fieldState: Record<string, unknown> = {}
      const gardenState: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(state ?? {})) {
        if (GARDEN_KEYS.includes(k)) gardenState[k] = v
        else fieldState[k] = v
      }
      localStorage.setItem(FIELD_STORAGE_KEY,  JSON.stringify({ state: fieldState,  version }))
      localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ state: gardenState, version }))
    } catch {
      /* ignore quota / serialization errors */
    }
  },
  removeItem: () => {
    localStorage.removeItem(FIELD_STORAGE_KEY)
    localStorage.removeItem(GARDEN_STORAGE_KEY)
  },
}

interface GardenStore {
  // Wizard navigation
  currentStep: WizardStep
  setStep: (step: WizardStep) => void

  // Step 1 — field dimensions
  field: FieldDimensions | null
  setField: (field: FieldDimensions) => void

  // Step 2 — plant selection
  allPlants: Plant[]
  setAllPlants: (plants: Plant[]) => void
  selectedPlantIds: number[]
  togglePlant: (id: number) => void

  // Step 3 — PV system
  pvRange: PVRange | null
  setPVRange: (range: PVRange) => void
  pvSystem: PVSystemConfig | null
  setPVSystem: (config: PVSystemConfig) => void

  // Summary — garden layout from API
  gardenLayout: GardenLayout | null
  setGardenLayout: (layout: GardenLayout) => void

  // Job id from the async /generate_field_layout response — used to mint a
  // signed PDF download URL on demand via GET /job_pdf_url/<jobId>.
  jobId: string | null
  setJobId: (id: string | null) => void

  // ── Garden Planner (additive; the field flow leaves these at defaults) ──────
  // Which flow produced the current summary — selects the PDF endpoint and
  // whether the summary streams. 'field' is the existing behaviour.
  summaryMode: 'field' | 'garden'
  setSummaryMode: (mode: 'field' | 'garden') => void
  // Streaming lifecycle for the garden layout (the field flow stays 'idle').
  layoutStatus: 'idle' | 'streaming' | 'done' | 'failed'
  setLayoutStatus: (s: 'idle' | 'streaming' | 'done' | 'failed') => void
  layoutError: string | null
  setLayoutError: (e: string | null) => void

  // ── Garden form (persisted, isolated from the field flow's field/selection) ──
  gardenField: FieldDimensions | null
  setGardenField: (field: FieldDimensions) => void
  gardenSelectedPlantIds: number[]
  toggleGardenPlant: (id: number) => void
  gardenStep: 1 | 2
  setGardenStep: (step: 1 | 2) => void
  // Clear the garden form + the transient summary fields (a fresh garden).
  resetGarden: () => void

  // Reset everything
  reset: () => void
}

const initialState = {
  currentStep: 1 as WizardStep,
  field: null,
  allPlants: [],
  selectedPlantIds: [],
  pvRange: null,
  pvSystem: null,
  gardenLayout: null,
  jobId: null,
  summaryMode: 'field' as 'field' | 'garden',
  layoutStatus: 'idle' as 'idle' | 'streaming' | 'done' | 'failed',
  layoutError: null as string | null,
  gardenField: null,
  gardenSelectedPlantIds: [],
  gardenStep: 1 as 1 | 2,
}

export const useGardenStore = create<GardenStore>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),

      setField: (field) => set({ field }),

      setAllPlants: (plants) => set({ allPlants: plants }),

      togglePlant: (id) =>
        set((state) => ({
          selectedPlantIds: state.selectedPlantIds.includes(id)
            ? state.selectedPlantIds.filter((p) => p !== id)
            : [...state.selectedPlantIds, id],
        })),

      setPVRange: (pvRange) => set({ pvRange }),

      setPVSystem: (pvSystem) => set({ pvSystem }),

      setGardenLayout: (gardenLayout) => set({ gardenLayout }),

      setJobId: (jobId) => set({ jobId }),

      setSummaryMode: (summaryMode) => set({ summaryMode }),

      setLayoutStatus: (layoutStatus) => set({ layoutStatus }),

      setLayoutError: (layoutError) => set({ layoutError }),

      setGardenField: (gardenField) => set({ gardenField }),

      toggleGardenPlant: (id) =>
        set((state) => ({
          gardenSelectedPlantIds: state.gardenSelectedPlantIds.includes(id)
            ? state.gardenSelectedPlantIds.filter((p) => p !== id)
            : [...state.gardenSelectedPlantIds, id],
        })),

      setGardenStep: (gardenStep) => set({ gardenStep }),

      resetGarden: () =>
        set({
          gardenField: null,
          gardenSelectedPlantIds: [],
          gardenStep: 1,
          gardenLayout: null,
          jobId: null,
          summaryMode: 'field',
          layoutStatus: 'idle',
          layoutError: null,
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'polygarden-wizard',   // logical label; physical keys are split (see splitStorage)
      storage: createJSONStorage(() => splitStorage),
      // Exclude allPlants (Plant class instances lose methods on JSON round-trip)
      // and gardenLayout (several MB of GeoJSON — always fetched fresh from API).
      partialize: (state) => ({
        currentStep: state.currentStep,
        field: state.field,
        selectedPlantIds: state.selectedPlantIds,
        pvRange: state.pvRange,
        pvSystem: state.pvSystem,
        // Garden form — persisted so it survives refresh/navigation.
        gardenField: state.gardenField,
        gardenSelectedPlantIds: state.gardenSelectedPlantIds,
        gardenStep: state.gardenStep,
      }),
    }
  )
)
