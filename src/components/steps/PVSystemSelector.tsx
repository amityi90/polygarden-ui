/**
 * Step 3 — PV System Configuration
 *
 * The pv_production field uses a range slider (min–max from the API).
 * The other three fields (battery_size, system_height, north_coordinate)
 * are numeric inputs validated with Zod.
 *
 * On submit: store PV config in Zustand, call /make_agrivoltaic_garden,
 * store the layout, then navigate to the summary page.
 */

import { useForm, Controller } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useGardenStore } from '../../store/gardenStore'
import { makeAgrivoltaicGarden } from '../../api/client'
import { useEffect, useRef, useState } from 'react'
import type { MakeGardenRequest } from '../../types'
import { LoadingModal } from '../ui/LoadingModal'

// Schema is built dynamically so we can reference pvRange from the store
function buildSchema(minKw: number, maxKw: number) {
  return z.object({
    pv_production: z.number().min(minKw).max(maxKw),
    battery_size: z.coerce.number().positive(),
    system_height: z.coerce.number().int('Must be a whole number.').min(4, 'Must be between 4 and 9 m.').max(9, 'Must be between 4 and 9 m.'),
  })
}

type FormValues = {
  pv_production: number
  battery_size: number
  system_height: number
}

export function PVSystemSelector() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pvRange, pvSystem, field, selectedPlantIds, setPVSystem, setGardenLayout, setJobId, setStep } = useGardenStore()
  const [apiError, setApiError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const min = pvRange?.min_kw ?? 0
  const max = pvRange?.max_kw ?? 100

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(min, max)) as unknown as Resolver<FormValues>,
    defaultValues: {
      pv_production: pvSystem?.pv_production ?? min,
      battery_size: pvSystem?.battery_size,
      system_height: pvSystem?.system_height,
    },
  })

  const pvProduction = watch('pv_production') ?? min

  const onSubmit = async (values: FormValues) => {
    if (!field) return
    setApiError(null)

    const pvConfig = {
      pv_production: values.pv_production,
      battery_size: values.battery_size,
      system_height: values.system_height,
      north_coordinate: field.north_coordinate,
    }
    setPVSystem(pvConfig)

    const body: MakeGardenRequest = {
      selected_plant_ids: selectedPlantIds,
      field_length: field.length,
      field_width: field.width,
      latitude: field.north_coordinate,
      pv_production: values.pv_production,
      battery_size: values.battery_size,
      system_height: values.system_height,
    }

    try {
      abortRef.current = new AbortController()
      const { layout, jobId } = await makeAgrivoltaicGarden(body, abortRef.current.signal)
      setGardenLayout(layout)
      setJobId(jobId)
      navigate('/summary')
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setApiError(msg === 'lost_connection' ? t('step3.generating.lost_connection') : msg)
    }
  }

  if (!pvRange) {
    return (
      <p className="text-[#9a9080] text-sm animate-pulse py-8 text-center">
        {t('step3.loading')}
      </p>
    )
  }

  return (
    <>
    <div className="flex flex-col gap-8">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h2 className="font-['Cormorant_Garant'] text-4xl font-semibold text-[#f0ece3]">
          {t('step3.title')}
        </h2>
        <p className="text-[#9a9080] text-sm leading-relaxed">
          {t('step3.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
        {/* PV Production slider */}
        <div className="flex flex-col gap-4 bg-[#111111] border border-white/8 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium tracking-widest text-[#9a9080] uppercase">
              {t('step3.pv_production')}
            </label>
            <span className="font-['Cormorant_Garant'] text-2xl font-semibold text-[#c9a84c]">
              {pvProduction.toFixed(1)} <span className="text-sm text-[#9a9080]">kW</span>
            </span>
          </div>

          <Controller
            control={control}
            name="pv_production"
            render={({ field: f }) => (
              <input
                type="range"
                min={min}
                max={max}
                step={0.1}
                value={f.value}
                onChange={(e) => f.onChange(parseFloat(e.target.value))}
                className="pv-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c9a84c ${((pvProduction - min) / (max - min)) * 100}%, rgba(255,255,255,0.08) 0%)`,
                }}
              />
            )}
          />

          <div className="flex justify-between text-xs text-[#5a5248]">
            <span>{min} kW (min)</span>
            <span>{t('step3.range_hint', { min: min.toFixed(1), max: max.toFixed(1) })}</span>
            <span>{max} kW (max)</span>
          </div>

          {errors.pv_production && (
            <p className="text-red-400 text-xs">{t('step3.errors.out_of_range', { min, max })}</p>
          )}
        </div>

        {/* Two numeric inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumericInput
            label={t('step3.battery_size')}
            unit="kWh"
            error={errors.battery_size?.message}
            registration={register('battery_size')}
          />
          <NumericInput
            label={t('step3.system_height')}
            unit="m"
            step={1}
            min={4}
            max={9}
            error={errors.system_height?.message}
            registration={register('system_height')}
          />
        </div>

        {/* API error */}
        {apiError && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {apiError}
          </p>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="px-6 py-3 border border-white/10 text-[#9a9080] font-medium text-sm tracking-wide rounded-lg hover:border-white/20 hover:text-[#f0ece3] transition-all cursor-pointer bg-transparent"
          >
            {t('wizard.back')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_rgba(201,168,76,0.2)] hover:shadow-[0_0_28px_rgba(201,168,76,0.35)] cursor-pointer"
          >
            {isSubmitting ? '…' : t('wizard.submit')}
          </button>
        </div>
      </form>
    </div>
    {isSubmitting && (
      <LoadingModal
        title={t('step3.generating.title')}
        subtitle={t('step3.generating.subtitle')}
      />
    )}
    </>
  )
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

interface NumericInputProps {
  label: string
  unit: string
  step?: number | 'any'
  min?: number
  max?: number
  error?: string
  registration: ReturnType<ReturnType<typeof useForm>['register']>
}

function NumericInput({ label, unit, step = 'any', min, max, error, registration }: NumericInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium tracking-widest text-[#9a9080] uppercase">
        {label}
      </label>
      <div className="relative">
        <input
          {...registration}
          type="number"
          step={step}
          min={min}
          max={max}
          className={[
            'w-full bg-[#111111] border rounded-lg px-4 py-3 pr-10 text-[#f0ece3] placeholder-[#5a5248] text-sm',
            'focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all',
            error ? 'border-red-400/50' : 'border-white/10 hover:border-white/20',
          ].join(' ')}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5248] text-xs pointer-events-none">
          {unit}
        </span>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
