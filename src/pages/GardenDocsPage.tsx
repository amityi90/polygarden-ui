import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Upload, Trash2, CalendarCog, ArrowLeft } from 'lucide-react'
import { listGardenPhotos, uploadGardenPhoto, deleteGardenPhoto, updatePhotoDate, type PhotoGroup } from '../api/client'
import { usePopupStore, notify } from '../store/popupStore'

export function GardenDocsPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const openPopup = usePopupStore((s) => s.openPopup)
  const [groups, setGroups] = useState<PhotoGroup[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const load = () => listGardenPhotos(id).then((r) => { setGroups(r.groups); setDates(r.dates) }).catch(() => notify('error', 'Failed to load photos'))
  useEffect(() => { void load() }, [id])

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const takenOn = dateRef.current?.value || undefined
    try {
      for (const f of Array.from(files)) await uploadGardenPhoto(id, f, takenOn)
      notify('success', files.length > 1 ? 'Photos uploaded' : 'Photo uploaded')
      await load()
    } catch (e) {
      notify('error', (e as Error).message.replace(/^API error \d+: /, '') || 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onEditDate = (photoId: string, current: string) => {
    openPopup({
      kind: 'prompt', title: 'Photo date', inputType: 'date', defaultValue: current, submitLabel: 'Save',
      onSubmit: async (d) => { await updatePhotoDate(id, photoId, d); notify('success', 'Date updated'); await load() },
    })
  }
  const onDelete = (photoId: string) => openPopup({
    kind: 'confirm', title: 'Delete this photo?', confirmLabel: 'Delete',
    onConfirm: async () => { await deleteGardenPhoto(id, photoId); notify('success', 'Photo deleted'); await load() },
  })

  const jumpTo = (d: string) => document.getElementById(`d-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm text-[#9a9080] hover:text-[#c9a84c] mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold text-[#f0ece3]">Garden Docs</h1>
        <div className="flex items-center gap-2">
          <input ref={dateRef} type="date" className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100" />
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
          <button
            onClick={() => fileRef.current?.click()} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium"
          >
            <Upload className="w-4 h-4" /> {busy ? 'Uploading…' : 'Upload photos'}
          </button>
        </div>
      </div>

      {/* date-navigation bar */}
      {dates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 border-b border-white/10">
          {dates.map((d) => (
            <button key={d} onClick={() => jumpTo(d)} className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-white/10 text-[#cfc8ba] hover:bg-white/5">
              {d}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-[#9a9080]">No photos yet — upload your first one above.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((grp) => (
            <section key={grp.date} id={`d-${grp.date}`}>
              <h2 className="text-sm font-medium text-[#c9a84c] mb-3">{grp.date}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {grp.photos.map((ph) => (
                  <div key={ph.id} className="group relative rounded-xl overflow-hidden border border-white/10 bg-neutral-900">
                    <img
                      src={ph.url} alt="" loading="lazy"
                      className="w-full h-36 object-cover cursor-pointer"
                      onClick={() => setLightbox(ph.url)}
                    />
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconBtn onClick={() => onEditDate(ph.id, grp.date)}><CalendarCog className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn danger onClick={() => onDelete(ph.id)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`p-1.5 rounded-md backdrop-blur ${danger ? 'bg-red-600/80 hover:bg-red-500 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
    >
      {children}
    </button>
  )
}
