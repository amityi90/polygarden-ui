/**
 * Step 1 — Field Dimensions
 *
 * Why React Hook Form + Zod?
 * ──────────────────────────
 * React Hook Form (RHF) registers inputs with a ref — it does NOT use useState
 * for each keystroke, so there are zero unnecessary re-renders as the user
 * types. Zod defines the validation schema as a TypeScript type at the same
 * time: one schema gives you both runtime validation AND compile-time types.
 * The `@hookform/resolvers/zod` adapter connects them with one line.
 *
 * On submit: store field dimensions in Zustand, call the PV range API,
 * then advance to step 2.
 */

import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useGardenStore } from '../../store/gardenStore'
import { calculateMinMaxPV } from '../../api/client'
import { useState } from 'react'

const schema = z.object({
  length: z.coerce.number().min(1, 'Must be between 1 and 200 m.').max(200, 'Must be between 1 and 200 m.'),
  width: z.coerce.number().min(1, 'Must be between 1 and 200 m.').max(200, 'Must be between 1 and 200 m.'),
  north_coordinate: z.coerce.number().min(-90).max(90),
})

type FormValues = { length: number; width: number; north_coordinate: number }

export function FieldDimensionsForm() {
  const { t } = useTranslation()
  const { field, setField, setPVRange, setStep } = useGardenStore()
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      length: field?.length,
      width: field?.width,
      north_coordinate: field?.north_coordinate,
    },
  })

  const onSubmit = async (values: FormValues) => {
    setApiError(null)
    try {
      setField({ length: values.length, width: values.width, north_coordinate: values.north_coordinate })
      const range = await calculateMinMaxPV({ latitude: values.north_coordinate, field_length: values.length, field_width: values.width })
      setPVRange(range)
      setStep(2)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h2 className="font-['Cormorant_Garant'] text-4xl font-semibold text-[#f0ece3]">
          {t('step1.title')}
        </h2>
        <p className="text-[#9a9080] text-sm leading-relaxed">
          {t('step1.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FieldInput
            label={t('step1.length')}
            unit={t('step1.unit')}
            placeholder={t('step1.length_placeholder')}
            min={1}
            max={200}
            error={errors.length?.message}
            registration={register('length')}
          />
          <FieldInput
            label={t('step1.width')}
            unit={t('step1.unit')}
            placeholder={t('step1.width_placeholder')}
            min={1}
            max={200}
            error={errors.width?.message}
            registration={register('width')}
          />
        </div>

        <FieldInput
          label={t('step1.north_coordinate')}
          unit="°"
          placeholder={t('step1.north_coordinate_placeholder')}
          error={errors.north_coordinate?.message}
          registration={register('north_coordinate')}
        />

        {/* Field preview */}
        <FieldPreviewHint />

        {/* API error */}
        {apiError && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {apiError}
          </p>
        )}

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_rgba(201,168,76,0.2)] hover:shadow-[0_0_28px_rgba(201,168,76,0.35)] cursor-pointer"
          >
            {isSubmitting ? '…' : t('wizard.next')}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldInputProps {
  label: string
  unit: string
  placeholder: string
  min?: number
  max?: number
  error?: string
  registration: ReturnType<ReturnType<typeof useForm>['register']>
}

function FieldInput({ label, unit, placeholder, min, max, error, registration }: FieldInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium tracking-widest text-[#9a9080] uppercase">
        {label}
      </label>
      <div className="relative">
        <input
          {...registration}
          type="number"
          min={min}
          max={max}
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
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </div>
  )
}

function FieldPreviewHint() {
  return (
    <div className="border border-white/8 rounded-xl p-5 bg-[#111111] flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#3a6b4a]/20 border border-[#3a6b4a]/40 flex items-center justify-center shrink-0">
        <span className="text-[#3a6b4a] text-lg">⬛</span>
      </div>
      <p className="text-[#9a9080] text-sm leading-relaxed">
        Your field runs <span className="text-[#f0ece3]">East–West</span>. Rows will be laid out parallel to this axis, with 2 m wide growing rows and 0.5 m tractor gaps.
      </p>
    </div>
  )
}
