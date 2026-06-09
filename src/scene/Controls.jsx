import { useEffect } from 'react'
import { Joystick } from 'react-joystick-component'

// True on touch devices only — desktop uses keyboard + mouse-drag instead.
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0)

// Keyboard works everywhere; on-screen joysticks render only on touch.
export default function Controls({ controller, barVisible = true }) {
  useEffect(() => {
    const pressed = new Set()
    const MOVE = {
      w: { x: 0, y: 1 },
      s: { x: 0, y: -1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    }
    const TURN = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: 1 },
      ArrowDown: { x: 0, y: -1 },
    }

    // Canonicalise so a key added on keydown is removed by keyup even if
    // Shift/CapsLock flipped its case in between — otherwise 'w' and 'W' desync
    // and a phantom key strands the input, so the camera moves forever.
    const canon = (k) => (k.length === 1 ? k.toLowerCase() : k)
    const isTyping = () => {
      const el = document.activeElement
      return (
        !!el &&
        (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
      )
    }

    function recompute() {
      const move = { x: 0, y: 0 }
      const turn = { x: 0, y: 0 }
      // Hold movement while typing in a field, but keep tracking keys so releases
      // stay symmetric.
      if (!isTyping()) {
        for (const k of pressed) {
          if (MOVE[k]) {
            move.x += MOVE[k].x
            move.y += MOVE[k].y
          }
          if (TURN[k]) {
            turn.x += TURN[k].x
            turn.y += TURN[k].y
          }
        }
      }
      controller.setMove(move.x, move.y)
      controller.setTurn(turn.x, turn.y)
    }

    const down = (e) => {
      if (isTyping()) return // don't hijack typing in inputs
      pressed.add(canon(e.key))
      recompute()
    }
    const up = (e) => {
      pressed.delete(canon(e.key))
      recompute()
    }
    // Focus/visibility loss can swallow the keyup, leaving a key stranded. Flush
    // held keys whenever the window can no longer receive them (alt-tab, clicking
    // the SDK iframe, switching tabs).
    const flush = () => {
      pressed.clear()
      recompute()
    }
    const onVisibility = () => {
      if (document.hidden) flush()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [controller])

  if (!IS_TOUCH) return null

  // Sit clear above the playback bar (≈9rem tall incl. its safe-area pad) so the
  // right stick never lands on the play button / scrubber. When the bar is hidden
  // the sticks drop back toward the bottom corners where the thumbs naturally rest.
  const bottom = barVisible
    ? 'bottom-[calc(9.5rem+env(safe-area-inset-bottom))]'
    : 'bottom-[calc(2rem+env(safe-area-inset-bottom))]'

  return (
    <div
      data-ui
      className={`pointer-events-none absolute left-0 z-10 flex w-full justify-between px-[7%] ${bottom}`}
    >
      <div className="pointer-events-auto" data-ui>
        <Joystick
          size={92}
          throttle={50}
          baseColor="rgba(0,0,0,0.4)"
          stickColor="#1DB954"
          move={(e) => controller.setMove(e.x, e.y)}
          stop={() => controller.setMove(0, 0)}
        />
      </div>
      <div className="pointer-events-auto" data-ui>
        <Joystick
          size={92}
          throttle={50}
          baseColor="rgba(0,0,0,0.4)"
          stickColor="#1DB954"
          move={(e) => controller.setTurn(e.x, e.y)}
          stop={() => controller.setTurn(0, 0)}
        />
      </div>
    </div>
  )
}
