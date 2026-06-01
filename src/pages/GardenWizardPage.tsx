import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useGardenStore } from '../store/gardenStore'
import { GardenStepWizard } from '../components/wizard/GardenStepWizard'

// The garden form (dimensions, plant selection, step) is persisted and restored
// on entry. A clean start is requested explicitly via navigation state
// `{ fresh: true }` — sent by the summary's "Plan Another Garden" — which resets
// the form here, on the garden page (so it can't trip the /summary redirect guard).
export function GardenWizardPage() {
  const location = useLocation()
  const resetGarden = useGardenStore((s) => s.resetGarden)

  useEffect(() => {
    if ((location.state as { fresh?: boolean } | null)?.fresh) resetGarden()
    // run once on mount; location.state is captured at navigation time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <GardenStepWizard />
}
