import { useTranslation } from 'react-i18next'
import type { WizardStep } from '../../types'

interface StepIndicatorProps {
  currentStep: WizardStep
}

const TOTAL = 3

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-center gap-0">
      {([1, 2, 3] as WizardStep[]).map((step) => {
        const isDone = step < currentStep
        const isActive = step === currentStep

        return (
          <div key={step} className="flex items-center">
            {/* Step circle */}
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
                  step
                )}
              </div>
              <span
                className={[
                  'text-xs tracking-wide whitespace-nowrap',
                  isActive ? 'text-[#c9a84c]' : 'text-[#5a5248]',
                ].join(' ')}
              >
                {t(`wizard.steps.${step}`)}
              </span>
            </div>

            {/* Connector line between steps */}
            {step < TOTAL && (
              <div
                className={[
                  'w-16 h-px mx-2 mb-5 transition-all duration-300',
                  isDone ? 'bg-[#c9a84c]/50' : 'bg-white/10',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}

      {/* Accessible label */}
      <span className="sr-only">
        {t('wizard.step', { current: currentStep, total: TOTAL })}
      </span>
    </div>
  )
}
