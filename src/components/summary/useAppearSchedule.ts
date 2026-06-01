/**
 * useAppearSchedule — staggered "pop-in" scheduling for streaming plants.
 *
 * As a garden streams, each poll appends a batch of new plant instances. This
 * hook diffs which keys are new and assigns each one a start time so a batch of
 * N cascades in over STAGGER_WINDOW_MS (plant i delayed by i × WINDOW / N).
 * Both the 2D canvas and the 3D view consume the same schedule, rendering the
 * resulting per-plant progress differently.
 *
 * Only the live-streamed *deltas* animate: the first snapshot (a full or
 * already-populated layout, e.g. the field planner or a finished garden) is
 * seeded without animation. When the plant count collapses to 0 (a new garden's
 * empty-bounds seed) the schedule resets so the next stream animates fresh.
 */

import { useCallback, useRef } from 'react'

export const STAGGER_WINDOW_MS = 250   // per-batch cascade window (mirrors the 0.25 s poll cadence)
export const POP_MS = 200              // each plant's own pop duration

export function appearKey(name: string, x: number, y: number): string {
  return `${name}|${x}|${y}`
}

// easeOutBack — subtle overshoot for a lively "pop"
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export interface AppearSchedule {
  /** Diff `keysInOrder` against what's been seen and schedule the new ones. */
  schedule: (keysInOrder: string[]) => void
  /** Eased scale 0→1 for a key (0 before its start, 1 once finished / unscheduled). */
  scale: (key: string, now: number) => number
  /** Linear fade 0→1 for a key. */
  alpha: (key: string, now: number) => number
  /** True while any scheduled key is still pending or mid-pop. */
  anyActive: (now: number) => boolean
}

export function useAppearSchedule(enabled: boolean, windowMs: number = STAGGER_WINDOW_MS): AppearSchedule {
  const seen = useRef<Set<string>>(new Set())
  const startAt = useRef<Map<string, number>>(new Map())
  const firstSnapshot = useRef(true)
  const prevCount = useRef(0)

  const schedule = useCallback((keysInOrder: string[]) => {
    if (!enabled) {
      // Keep state clean so enabling later starts from a fresh snapshot.
      seen.current.clear()
      startAt.current.clear()
      firstSnapshot.current = true
      prevCount.current = keysInOrder.length
      return
    }

    const count = keysInOrder.length

    // A new garden seeds an empty (0-plant) layout — reset so its stream animates.
    if (prevCount.current > 0 && count === 0) {
      seen.current.clear()
      startAt.current.clear()
      firstSnapshot.current = false
    }

    if (firstSnapshot.current) {
      // Seed the initial snapshot without animating (full layout / remount).
      for (const k of keysInOrder) seen.current.add(k)
      firstSnapshot.current = false
    } else {
      const fresh = keysInOrder.filter((k) => !seen.current.has(k))
      if (fresh.length > 0) {
        const now = performance.now()
        const step = windowMs / fresh.length
        fresh.forEach((k, j) => {
          startAt.current.set(k, now + j * step)
          seen.current.add(k)
        })
      }
    }
    prevCount.current = count
  }, [enabled, windowMs])

  const scale = useCallback((key: string, now: number): number => {
    const s = startAt.current.get(key)
    if (s === undefined) return 1
    const e = now - s
    if (e <= 0) return 0
    if (e >= POP_MS) {
      startAt.current.delete(key)   // prune finished entries
      return 1
    }
    return easeOutBack(e / POP_MS)
  }, [])

  const alpha = useCallback((key: string, now: number): number => {
    const s = startAt.current.get(key)
    if (s === undefined) return 1
    const e = now - s
    if (e <= 0) return 0
    if (e >= POP_MS) return 1
    return e / POP_MS
  }, [])

  const anyActive = useCallback((now: number): boolean => {
    for (const s of startAt.current.values()) {
      if (now < s + POP_MS) return true
    }
    return false
  }, [])

  return { schedule, scale, alpha, anyActive }
}
