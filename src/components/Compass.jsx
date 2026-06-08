import { useEffect, useRef } from 'react'

// A compass whose ring rotates with the player's heading. "OLDER" points toward
// world -Z (the past direction of the year axis), "NEWER" toward +Z. The ring's
// rotation equals the player's yaw, so the labels track where those directions
// are relative to where you're looking. The year sits fixed in the hub.
export default function Compass({ controller, year }) {
  const ringRef = useRef()

  useEffect(() => {
    let raf
    const tick = () => {
      if (ringRef.current) {
        const deg = (controller.state.yaw * 180) / Math.PI
        ringRef.current.style.transform = `rotate(${deg}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [controller])

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
      {/* fixed marker = your facing */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] text-white/70">▲</div>
      <div className="relative h-24 w-24 rounded-full border border-white/10 bg-black/45 backdrop-blur">
        <div ref={ringRef} className="absolute inset-0">
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] font-bold tracking-wide text-[#1DB954]">
            OLDER
          </span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] tracking-wide text-white/45">
            NEWER
          </span>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold leading-none text-white">{year ?? '—'}</span>
          <span className="text-[8px] uppercase tracking-widest text-white/40">year</span>
        </div>
      </div>
    </div>
  )
}
