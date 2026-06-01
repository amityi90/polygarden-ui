/**
 * Garden Planner — Step 1: Garden Dimensions
 *
 * Like the field planner's step 1 but trimmed for the garden: only length and
 * width (each capped at 20 m), no latitude, and NO PV-range API call. On submit
 * it stores the dimensions and advances to the plant selector (step 2).
 */

import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useGardenStore } from '../../store/gardenStore'

const MAX = 20

const schema = z.object({
  length: z.coerce.number().min(1, 'Must be between 1 and 20 m.').max(MAX, 'Must be between 1 and 20 m.'),
  width: z.coerce.number().min(1, 'Must be between 1 and 20 m.').max(MAX, 'Must be between 1 and 20 m.'),
})

type FormValues = { length: number; width: number }

export function GardenDimensionsForm() {
  const { t } = useTranslation()
  const { gardenField, setGardenField, setGardenStep } = useGardenStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      length: gardenField?.length,
      width: gardenField?.width,
    },
  })

  const onSubmit = (values: FormValues) => {
    // north_coordinate is unused by the garden algorithm; kept at 0 to satisfy
    // the shared FieldDimensions type. No PV-range call here.
    setGardenField({ length: values.length, width: values.width, north_coordinate: 0 })
    setGardenStep(2)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-['Cormorant_Garant'] text-4xl font-semibold text-[#f0ece3]">
          {t('garden.step1.title')}
        </h2>
        <p className="text-[#9a9080] text-sm leading-relaxed">
          {t('garden.step1.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FieldInput
            label={t('garden.step1.length')}
            unit={t('garden.step1.unit')}
            placeholder={t('garden.step1.length_placeholder')}
            error={errors.length?.message}
            registration={register('length')}
          />
          <FieldInput
            label={t('garden.step1.width')}
            unit={t('garden.step1.unit')}
            placeholder={t('garden.step1.width_placeholder')}
            error={errors.width?.message}
            registration={register('width')}
          />
        </div>

        <div className="border border-white/8 rounded-xl p-5 bg-[#111111] flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#3a6b4a]/20 border border-[#3a6b4a]/40 flex items-center justify-center shrink-0">
            <span className="text-[#3a6b4a] text-lg">🪴</span>
          </div>
          <p className="text-[#9a9080] text-sm leading-relaxed">
            {t('garden.step1.hint')}
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_rgba(201,168,76,0.2)] hover:shadow-[0_0_28px_rgba(201,168,76,0.35)] cursor-pointer"
          >
            {t('wizard.next')}
          </button>
        </div>
      </form>
    </div>
  )
}

interface FieldInputProps {
  label: string
  unit: string
  placeholder: string
  error?: string
  registration: ReturnType<ReturnType<typeof useForm>['register']>
}

function FieldInput({ label, unit, placeholder, error, registration }: FieldInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium tracking-widest text-[#9a9080] uppercase">
        {label}
      </label>
      <div className="relative">
        <input
          {...registration}
          type="number"
          min={1}
          max={MAX}
          placeholder={placeholder}
          className={[
            'w-full bg-[#111111] border rounded-lg px-4 py-3 pr-12 text-[#f0ece3] placeholder-[#5a5248] text-sm',
            'focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all',
            error ? 'border-red-400/50' : 'border-white/10 hover:border-white/20',
          ].join(' ')}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a5248] text-sm pointer-events-none">
          {unit}
        </span>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
