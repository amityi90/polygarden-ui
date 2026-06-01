import type { FeatureCollection } from 'geojson'
export type { RawPlant } from '../models/Plant'
export { Plant } from '../models/Plant'

// ─── Field ────────────────────────────────────────────────────────────────────

export interface FieldDimensions {
  length: number            // meters (east–west)
  width: number             // meters (north–south)
  north_coordinate: number  // decimal degrees — collected in step 1 for shadow calc
}

// ─── PV System ────────────────────────────────────────────────────────────────

export interface PVRange {
  min_kw: number
  max_kw: number
}

export interface PVSystemConfig {
  pv_production: number     // kW
  battery_size: number      // kWh
  system_height: number     // meters (affects shadow)
  north_coordinate: number  // degrees or meters — used for shadow calc
}

// ─── Form State (all 3 steps combined) ───────────────────────────────────────

export interface GardenFormState {
  field: FieldDimensions | null
  selected_plant_ids: number[]
  pv_system: PVSystemConfig | null
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface CalculateMinMaxPVRequest {
  latitude: number
  field_length: number
  field_width: number
}

export interface MakeGardenRequest {
  selected_plant_ids: number[]
  field_length: number
  field_width: number
  latitude: number
  pv_production: number
  battery_size: number
  system_height: number
}

// Garden Planner — the ecological circle-packing layout needs only the plot
// dimensions and the chosen plants (no latitude / PV).
export interface MakeGardenLayoutRequest {
  selected_plant_ids: number[]
  field_length: number
  field_width: number
}

// GeoJSON FeatureCollection — each Feature's properties describe what it is.
// property shapes:
//   type: 'plant_row'  → { type, row_index, plants: string[] }
//   type: 'gap'        → { type }
//   type: 'pv_row'     → { type, row_index, kw: number }
export type GardenLayout = FeatureCollection

// ─── Wizard ───────────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3
