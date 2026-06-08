import { IS_TOUCH } from '../scene/Controls'

// Controls info panel. Open state is owned by Experience (auto-shown only the
// first time ever; reopened from the Settings menu). No standalone button.
export default function Help({ open, setOpen }) {
  if (!open) return null

  const rows = IS_TOUCH
    ? [
        ['Left stick', 'Move'],
        ['Right stick / drag', 'Look around'],
      ]
    : [
        ['W A S D', 'Move'],
        ['Drag mouse', 'Look around'],
        ['Arrow keys', 'Look around'],
      ]

  return (
    <div
      data-ui
      className="absolute left-4 top-4 z-20 w-60 rounded-xl bg-black/70 p-4 text-sm text-white backdrop-blur"
    >
      <div className="mb-2 font-bold text-[#1DB954]">Controls</div>
      <ul className="space-y-1.5">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-3">
            <span className="font-mono text-white/60">{k}</span>
            <span className="text-white/90">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-snug text-white/45">
        Each room is a track. Walk <b>forward</b> to travel back through the years;
        walk <b>sideways</b> for more tracks from that year.
      </p>
      <button
        onClick={() => setOpen(false)}
        className="mt-3 w-full rounded-full bg-[#1DB954] py-1.5 text-xs font-bold text-black"
      >
        Got it
      </button>
    </div>
  )
}
