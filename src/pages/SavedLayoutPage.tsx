import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGarden, getGardenLayout, getAllPlants } from '../api/client'
import { useGardenStore } from '../store/gardenStore'
import { notify } from '../store/popupStore'

/**
 * "See layout" — load a saved layout's GeoJSON into the store and reuse the
 * existing Summary renderer (2D/3D) in done/read-only state.
 */
export function SavedLayoutPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const {
    allPlants, setAllPlants, setGardenLayout, setField, setGardenField, setSummaryMode, setLayoutStatus, setSavedView,
  } = useGardenStore()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (allPlants.length === 0) setAllPlants(await getAllPlants())
        const [g, geojson] = await Promise.all([getGarden(id), getGardenLayout(id)])
        if (cancelled) return
        const dims = { length: g.field_length, width: g.field_width, north_coordinate: 0 }
        setField(dims); setGardenField(dims)
        setSummaryMode(g.mode)
        setGardenLayout(geojson)
        setLayoutStatus('done')
        setSavedView(true)
        navigate('/summary', { replace: true })
      } catch (e) {
        notify('error', (e as Error).message || 'Could not open layout')
        navigate('/dashboard', { replace: true })
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return <div className="flex-1 flex items-center justify-center text-[#9a9080]">Opening layout…</div>
}
