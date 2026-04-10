/**
 * StepWizard — the outer shell that wraps all 3 steps.
 *
 * It reads `currentStep` from Zustand and renders the correct step component.
 * The navigation buttons (Back / Next) are owned here so they're always in
 * the same position regardless of which step is active.
 */

import { useGardenStore } from '../../store/gardenStore'
import { StepIndicator } from './StepIndicator'
import { ProgressBar } from './ProgressBar'
import { FieldDimensionsForm } from '../steps/FieldDimensionsForm'
import { PlantSelector } from '../steps/PlantSelector'
import { PVSystemSelector } from '../steps/PVSystemSelector'
import type { WizardStep } from '../../types'

const TOTAL_STEPS = 3

export function StepWizard() {
  const { currentStep } = useGardenStore()

  const stepComponents: Record<WizardStep, React.ReactNode> = {
    1: <FieldDimensionsForm />,
    2: <PlantSelector />,
    3: <PVSystemSelector />,
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 py-12 gap-10">
      {/* Progress */}
      <div className="flex flex-col gap-6">
        <StepIndicator currentStep={currentStep} />
        <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Step content */}
      <div className="flex-1">
        {stepComponents[currentStep]}
      </div>
    </div>
  )
}
