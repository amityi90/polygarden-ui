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
import { persist } from 'zustand/middleware'
import type { FieldDimensions, PVRange, PVSystemConfig, GardenLayout, WizardStep } from '../types'
import type { Plant } from '../models/Plant'

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

  // PDF embedded in the /generate_field_layout response (Base64)
  pdfBase64: string | null
  setPdfBase64: (b64: string | null) => void

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
  pdfBase64: null,
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

      setPdfBase64: (pdfBase64) => set({ pdfBase64 }),

      reset: () => set(initialState),
    }),
    {
      name: 'polygarden-wizard',
      // Exclude allPlants (Plant class instances lose methods on JSON round-trip)
      // and gardenLayout (several MB of GeoJSON — always fetched fresh from API).
      partialize: (state) => ({
        currentStep: state.currentStep,
        field: state.field,
        selectedPlantIds: state.selectedPlantIds,
        pvRange: state.pvRange,
        pvSystem: state.pvSystem,
      }),
    }
  )
)
