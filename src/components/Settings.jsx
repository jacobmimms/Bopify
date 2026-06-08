import { useEffect, useRef, useState } from 'react'
import { GENRES, prettyGenre } from '../lib/genres'

function Toggle({ label, on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 py-1.5 text-left"
    >
      <span className="text-sm text-white/90">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-[#1DB954]' : 'bg-white/20'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

export default function Settings({
  showCompass,
  setShowCompass,
  showBar,
  setShowBar,
  showYearPicker,
  setShowYearPicker,
  invertDrag,
  setInvertDrag,
  genre,
  setGenre,
  onShowHelp,
  onLogout,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef()

  // close when clicking/tapping outside the gear + panel
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg text-white/70 backdrop-blur hover:text-white"
        aria-label="Settings"
      >
        ⚙
      </button>

      {open && (
        <div
          data-ui
          className="absolute right-4 top-16 z-20 w-56 rounded-xl bg-black/75 p-4 text-white backdrop-blur"
        >
          <div className="mb-2 font-bold text-[#1DB954]">Settings</div>
          <label className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-white/90">Genre</span>
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value)
                e.target.blur() // release focus so arrow keys go back to look-around
              }}
              className="max-w-[55%] rounded bg-white/10 px-2 py-1 text-sm text-white outline-none"
            >
              <option value="">All</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {prettyGenre(g)}
                </option>
              ))}
            </select>
          </label>
          <Toggle label="Compass" on={showCompass} onChange={setShowCompass} />
          <Toggle label="Playback bar" on={showBar} onChange={setShowBar} />
          <Toggle label="Year picker" on={showYearPicker} onChange={setShowYearPicker} />
          <Toggle label="Invert drag" on={invertDrag} onChange={setInvertDrag} />
          <button
            onClick={() => {
              onShowHelp?.()
              setOpen(false)
            }}
            className="mt-3 w-full rounded-full bg-white/10 py-2 text-sm text-white/80 hover:bg-white/20"
          >
            Controls / Help
          </button>
          <button
            onClick={onLogout}
            className="mt-2 w-full rounded-full bg-white/10 py-2 text-sm text-white/80 hover:bg-white/20"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
