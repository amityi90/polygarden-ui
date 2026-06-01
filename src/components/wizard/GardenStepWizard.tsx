/**
 * GardenStepWizard — the 2-step shell for the Garden Planner.
 *
 * Step 1: garden dimensions (length + width, max 20 m).
 * Step 2: the shared PlantSelector (trees hidden), with the "Generate Garden"
 *         button living right on this step.
 *
 * Kept separate from the field planner's 3-step StepWizard so neither flow can
 * affect the other. On generate it POSTs the garden job, seeds an empty layout
 * (so the 2D canvas has a valid extent), and navigates to /summary — where the
 * streaming poll actually runs (so leaving this component doesn't abort it).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useGardenStore } from '../../store/gardenStore'
import { startGarden } from '../../api/client'
import { ProgressBar } from './ProgressBar'
import { GardenDimensionsForm } from '../steps/GardenDimensionsForm'
import { PlantSelector } from '../steps/PlantSelector'
import type { GardenLayout } from '../../types'

const TOTAL_STEPS = 2

function emptyGarden(length: number, width: number): GardenLayout {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [length, 0], [length, width], [0, width], [0, 0]]],
      },
      properties: { type: 'garden_bounds' },
    }],
  }
}

export function GardenStepWizard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    gardenStep, gardenField, gardenSelectedPlantIds, toggleGardenPlant, setGardenStep,
    setField, setJobId, setSummaryMode, setLayoutStatus, setLayoutError, setGardenLayout,
  } = useGardenStore()

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step = gardenStep

  const generate = async () => {
    if (!gardenField || gardenSelectedPlantIds.length === 0) return
    setError(null)
    setStarting(true)
    try {
      const jobId = await startGarden({
        selected_plant_ids: gardenSelectedPlantIds,
        field_length: gardenField.length,
        field_width: gardenField.width,
      })
      // Mirror the garden dimensions into the shared `field` so the summary
      // header and the 3D ground plane (which read `field`) work for the garden.
      setField(gardenField)
      setJobId(jobId)
      setSummaryMode('garden')
      setLayoutError(null)
      setLayoutStatus('streaming')
      setGardenLayout(emptyGarden(gardenField.length, gardenField.width))
      navigate('/summary')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStarting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 py-12 gap-10">
      {/* Progress */}
      <div className="flex flex-col gap-6">
        <GardenStepIndicator currentStep={step} />
        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Step content */}
      <div className="flex-1">
        {step === 1 ? (
          <GardenDimensionsForm />
        ) : (
          <PlantSelector
            hideTrees
            selectedIds={gardenSelectedPlantIds}
            onToggle={toggleGardenPlant}
            onBack={() => setGardenStep(1)}
            onNext={generate}
            nextLabel={t('garden.generate')}
            nextBusy={starting}
          />
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Compact 2-step indicator (local, so the shared StepIndicator is untouched) ─

function GardenStepIndicator({ currentStep }: { currentStep: number }) {
  const { t } = useTranslation()
  const steps = [1, 2]
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => {
        const isDone = s < currentStep
        const isActive = s === currentStep
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'bg-[#c9a84c] text-[#0a0a0a] shadow-[0_0_16px_rgba(201,168,76,0.4)]'
                    : isDone
                    ? 'bg-[#c9a84c]/20 border border-[#c9a84c]/60 text-[#c9a84c]'
                    : 'bg-white/5 border border-white/10 text-[#5a5248]',
                ].join(' ')}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              <span className={['text-xs tracking-wide whitespace-nowrap', isActive ? 'text-[#c9a84c]' : 'text-[#5a5248]'].join(' ')}>
                {t(`garden.steps.${s}`)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={['w-16 h-px mx-2 mb-5 transition-all duration-300', isDone ? 'bg-[#c9a84c]/50' : 'bg-white/10'].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
