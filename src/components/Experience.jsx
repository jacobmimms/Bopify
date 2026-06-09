import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer'
import { createCameraController } from '../scene/cameraController'
import World from '../scene/World'
import Controls, { IS_TOUCH } from '../scene/Controls'
import PlaybackBar from './PlaybackBar'
import Help from './Help'
import Settings from './Settings'
import Compass from './Compass'
import YearPicker from './YearPicker'
import { prettyGenre } from '../lib/genres'

const ROOM = 20
const CURRENT_YEAR = new Date().getFullYear()

export default function Experience({ onLogout }) {
  const { player, deviceId, error } = useSpotifyPlayer()
  const controllerRef = useRef(null)
  if (!controllerRef.current) controllerRef.current = createCameraController()
  const controller = controllerRef.current
  const [meta, setMeta] = useState(null)
  const [showCompass, setShowCompassState] = useState(
    () => localStorage.getItem('bopify_compass') !== 'off',
  )
  const setShowCompass = (v) => {
    localStorage.setItem('bopify_compass', v ? 'on' : 'off')
    setShowCompassState(v)
  }
  const [showBar, setShowBarState] = useState(
    () => localStorage.getItem('bopify_bar') !== 'off',
  )
  const setShowBar = (v) => {
    localStorage.setItem('bopify_bar', v ? 'on' : 'off')
    setShowBarState(v)
  }
  const [showYearPicker, setShowYearPickerState] = useState(
    () => localStorage.getItem('bopify_yearpicker') !== 'off',
  )
  const setShowYearPicker = (v) => {
    localStorage.setItem('bopify_yearpicker', v ? 'on' : 'off')
    setShowYearPickerState(v)
  }
  // Help auto-opens only the first time ever; after that it's "seen".
  const [helpOpen, setHelpOpen] = useState(() => !localStorage.getItem('bopify_help_seen'))
  useEffect(() => {
    localStorage.setItem('bopify_help_seen', '1')
  }, [])
  const [genre, setGenreState] = useState(() => localStorage.getItem('bopify_genre') || '')
  const setGenre = (g) => {
    localStorage.setItem('bopify_genre', g)
    setGenreState(g) // World reseeds in place at the current year with the new genre
  }
  const [invertDrag, setInvertDragState] = useState(
    () => localStorage.getItem('bopify_invert') === 'on',
  )
  const invertRef = useRef(invertDrag)
  const setInvertDrag = (v) => {
    localStorage.setItem('bopify_invert', v ? 'on' : 'off')
    invertRef.current = v
    setInvertDragState(v)
  }

  // Activate the SDK audio element on first gesture (browser autoplay policy).
  useEffect(() => {
    if (!player) return
    const activate = () => {
      player.activateElement?.()
      window.removeEventListener('pointerdown', activate)
      window.removeEventListener('keydown', activate)
    }
    window.addEventListener('pointerdown', activate)
    window.addEventListener('keydown', activate)
    return () => {
      window.removeEventListener('pointerdown', activate)
      window.removeEventListener('keydown', activate)
    }
  }, [player])

  // Drag to look — works on desktop (mouse) and touch. Ignores drags that start
  // on UI (joysticks, bars, panels, buttons). Invert flips both axes.
  const drag = useRef({ active: false, x: 0, y: 0 })
  useEffect(() => {
    const onDown = (e) => {
      if (e.button > 0) return // ignore right/middle mouse
      if (e.target.closest('[data-ui], button, a, input, select')) return
      drag.current = { active: true, x: e.clientX, y: e.clientY }
    }
    const onMove = (e) => {
      if (!drag.current.active) return
      // Self-correct if a release was missed (button let go outside the window):
      // no buttons down means the drag is over.
      if (e.buttons === 0) {
        drag.current.active = false
        return
      }
      const s = invertRef.current ? -1 : 1
      controller.applyLook((e.clientX - drag.current.x) * s, (e.clientY - drag.current.y) * s)
      drag.current.x = e.clientX
      drag.current.y = e.clientY
    }
    const onUp = () => {
      drag.current.active = false
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    // pointercancel (touch gestures) and blur (release outside the window) also
    // end the drag — otherwise the view keeps spinning with no button held.
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [controller])

  // Teleport to the centre of the picked year's row (keeping the current column).
  const teleportToYear = (year) => {
    controller.jumpTo(controller.state.position.x, (year - CURRENT_YEAR) * ROOM)
  }

  const ready = !!deviceId

  return (
    <div className="relative h-full w-full touch-none bg-[#05070a]">
      <Canvas
        shadows={true}
        dpr={IS_TOUCH ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {ready && (
          <World
            controller={controller}
            deviceId={deviceId}
            player={player}
            genre={genre}
            onMeta={setMeta}
          />
        )}
      </Canvas>

      {ready && <Controls controller={controller} barVisible={showBar} />}
      {ready && showBar && <PlaybackBar player={player} meta={meta} />}
      {ready && <Help open={helpOpen} setOpen={setHelpOpen} />}
      {ready && (
        <Settings
          showCompass={showCompass}
          setShowCompass={setShowCompass}
          showBar={showBar}
          setShowBar={setShowBar}
          showYearPicker={showYearPicker}
          setShowYearPicker={setShowYearPicker}
          invertDrag={invertDrag}
          setInvertDrag={setInvertDrag}
          genre={genre}
          setGenre={setGenre}
          onShowHelp={() => setHelpOpen(true)}
          onLogout={onLogout}
        />
      )}
      {ready && showCompass && <Compass controller={controller} year={meta?.year} />}
      {ready && showYearPicker && <YearPicker activeYear={meta?.year} onPick={teleportToYear} />}

      {ready && meta?.empty && (
        <div className="pointer-events-none absolute left-1/2 top-28 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-center text-sm text-white/85 backdrop-blur">
          {genre ? `No ${prettyGenre(genre)} tracks around ${meta.year}` : `Nothing here`}
          <span className="text-white/45"> — walk to another year</span>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 text-center text-white">
          {error ? (
            <>
              <p className="text-red-400">Can’t start playback</p>
              <p className="max-w-sm text-sm text-neutral-400">{error}</p>
              <button className="btn-spotify mt-2" onClick={onLogout}>
                Back to login
              </button>
            </>
          ) : (
            <p className="animate-pulse text-neutral-400">Connecting player…</p>
          )}
        </div>
      )}
    </div>
  )
}
