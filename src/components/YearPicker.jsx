import { useEffect, useRef, useState } from 'react'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1850
const ITEM_H = 44
const VIEW_H = 220
const PAD = (VIEW_H - ITEM_H) / 2

const YEARS = []
for (let y = CURRENT_YEAR; y >= MIN_YEAR; y--) YEARS.push(y)

const idxToYear = (i) => CURRENT_YEAR - i
const yearToIdx = (y) => CURRENT_YEAR - y

// Vertical carousel. Scroll by mouse-drag, touch-swipe, or wheel; click a year
// to pick it. Teleport fires only after the scroll settles. Arrow keys are NOT
// captured here (they drive look-around).
export default function YearPicker({ activeYear, onPick }) {
  const ref = useRef()
  const lockSync = useRef(false) // ignore programmatic scrolls
  const settle = useRef()
  const drag = useRef({ active: false, y: 0, top: 0, moved: false })
  const [centered, setCentered] = useState(activeYear ?? CURRENT_YEAR)

  // Sync to the player's year while they walk (don't teleport).
  useEffect(() => {
    if (activeYear == null || lockSync.current || drag.current.active) return
    const el = ref.current
    if (!el) return
    const target = yearToIdx(activeYear) * ITEM_H
    if (Math.abs(el.scrollTop - target) > 2) {
      lockSync.current = true
      el.scrollTop = target
      setTimeout(() => (lockSync.current = false), 80)
    }
    setCentered(activeYear)
  }, [activeYear])

  // Cancel a pending teleport if the picker unmounts (e.g. toggled off) so it
  // can't yank the camera after it's gone.
  useEffect(() => () => clearTimeout(settle.current), [])

  const scheduleTeleport = (year) => {
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      if (year !== activeYear) onPick(year)
    }, 450)
  }

  const onScroll = () => {
    if (lockSync.current) return
    const year = Math.min(
      CURRENT_YEAR,
      Math.max(MIN_YEAR, idxToYear(Math.round(ref.current.scrollTop / ITEM_H))),
    )
    setCentered(year)
    scheduleTeleport(year)
  }

  // --- mouse drag-to-scroll (touch uses native scrolling) ---
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse') return
    const el = ref.current
    el.style.scrollSnapType = 'none' // avoid fighting snap mid-drag
    drag.current = { active: true, y: e.clientY, top: el.scrollTop, moved: false }
    el.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current.active) return
    const dy = e.clientY - drag.current.y
    if (Math.abs(dy) > 3) drag.current.moved = true
    ref.current.scrollTop = drag.current.top - dy
  }
  const onPointerUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    ref.current.style.scrollSnapType = 'y mandatory' // snaps -> onScroll -> settle
  }

  const clickYear = (year) => {
    if (drag.current.moved) return // it was a drag, not a click
    const el = ref.current
    el.scrollTo({ top: yearToIdx(year) * ITEM_H, behavior: 'smooth' })
    setCentered(year)
    scheduleTeleport(year)
  }

  return (
    <div data-ui className="absolute right-3 top-1/2 z-20 -translate-y-1/2">
      <div className="relative">
        <div
          className="pointer-events-none absolute left-0 right-0 border-y border-white/15"
          style={{ top: PAD, height: ITEM_H }}
        />
        <div
          ref={ref}
          tabIndex={-1}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(e) => {
            // never let the picker eat arrow keys — those are for look-around
            if (e.key.startsWith('Arrow')) e.preventDefault()
          }}
          className="no-scrollbar w-20 cursor-grab touch-pan-y snap-y snap-mandatory overflow-y-scroll outline-none active:cursor-grabbing"
          style={{ height: VIEW_H, scrollSnapType: 'y mandatory' }}
        >
          <div style={{ height: PAD }} />
          {YEARS.map((y) => {
            const d = Math.abs(y - centered)
            const cls =
              d === 0
                ? 'text-2xl font-bold text-[#1DB954]'
                : d === 1
                  ? 'text-base text-white/70'
                  : 'text-sm text-white/30'
            return (
              <div
                key={y}
                onClick={() => clickYear(y)}
                className="flex cursor-pointer snap-center items-center justify-center"
                style={{ height: ITEM_H }}
              >
                <span className={cls}>{y}</span>
              </div>
            )
          })}
          <div style={{ height: PAD }} />
        </div>
      </div>
    </div>
  )
}
