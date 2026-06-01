/**
 * Plant class — adapter between the raw DB row and the UI.
 *
 * Why a class instead of an interface?
 * ─────────────────────────────────────
 * The DB returns snake_case fields (planting_start: 3, planting_end: 5).
 * The UI wants formatted display values ("Mar – May"). A class lets us
 * define that formatting once as a getter, so every component that touches
 * a Plant gets the formatted value for free — no helper functions scattered
 * across files, no risk of formatting it differently in two places.
 *
 * The constructor takes a RawPlant (the exact API shape) and maps it to
 * clean camelCase properties. Nothing outside this file needs to know
 * what the DB column names look like.
 */

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Shape of the raw JSON row from GET /all_plants
export interface RawPlant {
  id: number
  name: string
  planting_start: number    // 1–12
  planting_end: number      // 1–12
  harvesting_start: number  // 1–12
  harvesting_end: number    // 1–12
  water: number             // ml per day
  shadow: boolean           // true = likes shade
  height: number            // cm
  spread: number            // cm
  body_water: boolean       // true = tolerates water on leaves
  is_tree: boolean
  companion_plants?: { id: number; name: string }[]   // nested companions from /all_plants
}

export class Plant {
  readonly id: number
  readonly name: string
  readonly plantingStart: number
  readonly plantingEnd: number
  readonly harvestingStart: number
  readonly harvestingEnd: number
  readonly water: number
  readonly shadow: boolean
  readonly height: number
  readonly spread: number
  readonly bodyWater: boolean
  readonly isTree: boolean
  readonly companionIds: number[]

  constructor(raw: RawPlant) {
    this.id = raw.id
    this.name = raw.name
    this.plantingStart = raw.planting_start
    this.plantingEnd = raw.planting_end
    this.harvestingStart = raw.harvesting_start
    this.harvestingEnd = raw.harvesting_end
    this.water = raw.water
    this.shadow = raw.shadow
    this.height = raw.height
    this.spread = raw.spread
    this.bodyWater = raw.body_water
    this.isTree = raw.is_tree
    this.companionIds = raw.companion_plants?.map((c) => c.id) ?? []
  }

  // ─── Formatted display getters ──────────────────────────────────────────────

  /** "Mar – May" */
  get plantingSeason(): string {
    return `${MONTH_NAMES[this.plantingStart]} – ${MONTH_NAMES[this.plantingEnd]}`
  }

  /** "Jun – Sep" */
  get harvestingSeason(): string {
    return `${MONTH_NAMES[this.harvestingStart]} – ${MONTH_NAMES[this.harvestingEnd]}`
  }

  /** "45 cm" */
  get heightLabel(): string {
    return `${this.height} cm`
  }

  /** "30 cm" */
  get spreadLabel(): string {
    return `${this.spread} cm`
  }

  /** "4.2 ml/d" */
  get waterLabel(): string {
    return `${this.water} ml/d`
  }

  /** "Shade" | "Sun" */
  get shadowLabel(): string {
    return this.shadow ? 'Shade' : 'Sun'
  }

  /** "Wet" | "Dry" — whether it tolerates water on leaves */
  get bodyWaterLabel(): string {
    return this.bodyWater ? 'Wet ok' : 'Dry'
  }

  /** "Tree" | "Plant" */
  get isTreeLabel(): string {
    return this.isTree ? 'Tree' : 'Plant'
  }
}
