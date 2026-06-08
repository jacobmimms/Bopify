import { useEffect, useRef, useState } from 'react'

const fmt = (ms) => {
  const s = Math.floor((ms || 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-[1px] fill-current" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
)

const Shell = ({ children }) => (
  <div
    data-ui
    className="absolute bottom-0 left-0 z-20 w-full bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10"
  >
    <div className="mx-auto max-w-md">{children}</div>
  </div>
)

// Bottom transport. The DISPLAYED track is the current room's track (`meta`) —
// the single source of truth — so it never goes stale when playback pauses in an
// empty room. The SDK is polled only for live position/paused, and trusted only
// when it's actually on that same track (otherwise we show 0:00 / paused).
export default function PlaybackBar({ player, meta }) {
  const [st, setSt] = useState(null)
  const [seek, setSeek] = useState(null)
  const seeking = useRef(false)

  useEffect(() => {
    if (!player) return
    let alive = true
    const poll = async () => {
      const s = await player.getCurrentState()
      if (alive && !seeking.current) setSt(s)
    }
    poll()
    const id = setInterval(poll, 250)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [player])

  const track = meta?.track

  // No track in this room (empty year+genre, or out-of-range plain).
  if (!track) {
    return (
      <Shell>
        <div className="py-3 text-center text-sm text-white/40">
          {meta?.empty ? 'No tracks in this room' : '—'}
        </div>
      </Shell>
    )
  }

  const sdkOnTrack = st?.track_window?.current_track?.id === track.id
  const duration = track.duration_ms || st?.duration || 0
  const position = seek != null ? seek : sdkOnTrack ? st.position : 0
  const paused = sdkOnTrack ? st.paused : true
  const cover = track.album?.images?.[0]?.url
  const artists = (track.artists || []).map((a) => a.name).join(', ')

  const commit = (ms) => {
    player.seek(ms).finally(() => {
      seeking.current = false
      setSeek(null)
    })
  }

  return (
    <Shell>
      <div className="flex items-center gap-3">
        {cover && (
          <img
            src={cover}
            alt=""
            crossOrigin="anonymous"
            className="h-12 w-12 shrink-0 rounded-md object-cover shadow-lg"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight text-white">{track.name}</div>
          <div className="truncate text-xs leading-tight text-white/55">{artists}</div>
        </div>
        <button
          onClick={() => player.togglePlay()}
          disabled={!sdkOnTrack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-black transition active:scale-95 disabled:opacity-40"
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="w-9 text-right text-[10px] tabular-nums text-white/45">{fmt(position)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={position}
          disabled={!sdkOnTrack}
          onChange={(e) => {
            seeking.current = true
            setSeek(Number(e.target.value))
          }}
          onPointerUp={(e) => commit(Number(e.currentTarget.value))}
          className="h-1 flex-1 cursor-pointer accent-[#1DB954] disabled:cursor-default"
        />
        <span className="w-9 text-[10px] tabular-nums text-white/45">{fmt(duration)}</span>
      </div>
    </Shell>
  )
}
