import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, Leaf, Flower2, Apple, Moon, Images, FileDown, Eye, ListTree, Pencil, Trash2 } from 'lucide-react'
import {
  listGardens, deleteGarden, renameGarden, getSavedPdfUrl, getGardenPlants,
  type SavedGarden, type PlantedPlant,
} from '../api/client'
import { usePopupStore, notify } from '../store/popupStore'

const STAGE_ICON: Record<string, typeof Sprout> = {
  seedling: Sprout, vegetative: Leaf, blooming: Flower2, fruiting: Apple, dormant: Moon,
}
function StageIcon({ stage }: { stage: string | null }) {
  const Icon = STAGE_ICON[stage ?? 'dormant'] ?? Leaf
  return <Icon className="w-4 h-4 text-emerald-400" aria-label={stage ?? 'stage'} />
}

export function DashboardPage() {
  const navigate = useNavigate()
  const openPopup = usePopupStore((s) => s.openPopup)
  const [gardens, setGardens] = useState<SavedGarden[]>([])
  const [loading, setLoading] = useState(true)
  const [openPlants, setOpenPlants] = useState<string | null>(null)
  const [plants, setPlants] = useState<PlantedPlant[]>([])

  const load = () => {
    setLoading(true)
    listGardens().then(setGardens).catch(() => notify('error', 'Failed to load your gardens')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const togglePlants = async (id: string) => {
    if (openPlants === id) { setOpenPlants(null); return }
    setOpenPlants(id); setPlants([])
    try { setPlants((await getGardenPlants(id)).plants) } catch { notify('error', 'Failed to load plants') }
  }

  const onPdf = async (id: string) => {
    try { window.open(await getSavedPdfUrl(id), '_blank') } catch { notify('error', 'No PDF for this item') }
  }
  const onRename = (g: SavedGarden) => {
    openPopup({
      kind: 'prompt', title: 'Rename', defaultValue: g.name, submitLabel: 'Save',
      onSubmit: async (name) => { await renameGarden(g.id, name); notify('success', 'Renamed'); load() },
    })
  }
  const onDelete = (g: SavedGarden) => {
    openPopup({
      kind: 'confirm', title: `Delete "${g.name}"?`,
      message: 'This removes the layout, PDF and all its photos. This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => { await deleteGarden(g.id); notify('success', 'Deleted'); load() },
    })
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-10">
      <h1 className="text-2xl font-semibold text-[#f0ece3] mb-6">My Gardens &amp; Fields</h1>

      {loading ? (
        <p className="text-[#9a9080]">Loading…</p>
      ) : gardens.length === 0 ? (
        <p className="text-[#9a9080]">Nothing saved yet. Generate a layout and hit <span className="text-emerald-400">Save to my account</span>.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {gardens.map((g) => (
            <div key={g.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[#f0ece3] font-medium">{g.name}</h3>
                  <p className="text-xs text-[#9a9080]">
                    G{g.serial_no} · {g.field_length}×{g.field_width} m · {g.created_at?.slice(0, 10)}
                  </p>
                </div>
                <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${g.mode === 'garden' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>
                  {g.mode}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Action icon={Eye} label="Layout" onClick={() => navigate(`/dashboard/${g.id}/view`)} />
                <Action icon={FileDown} label="PDF" onClick={() => onPdf(g.id)} />
                <Action icon={ListTree} label="Plants" onClick={() => togglePlants(g.id)} />
                <Action icon={Images} label="Docs" onClick={() => navigate(`/dashboard/${g.id}/docs`)} />
                <Action icon={Pencil} label="Rename" onClick={() => onRename(g)} />
                <Action icon={Trash2} label="Delete" danger onClick={() => onDelete(g)} />
              </div>

              {openPlants === g.id && (
                <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-white/10 divide-y divide-white/5">
                  {plants.length === 0 ? (
                    <p className="text-xs text-[#9a9080] p-3">No per-plant list (large field — summary only).</p>
                  ) : plants.map((p) => (
                    <div key={p.serial} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <StageIcon stage={p.stage} />
                      <span className="text-[#f0ece3] font-mono">{p.serial}</span>
                      <span className="text-[#9a9080]">{p.name}</span>
                      <span className="ml-auto text-[#6a6256]">({p.x.toFixed(1)}, {p.y.toFixed(1)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Action({ icon: Icon, label, onClick, danger }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
        danger ? 'border-red-500/30 text-red-300 hover:bg-red-500/10' : 'border-white/10 text-[#cfc8ba] hover:bg-white/5'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  )
}
