import { login } from '../auth/spotify-auth'

export default function Login() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-neutral-900 to-black text-center text-white">
      <h1 className="text-6xl font-black tracking-tight">
        Bop<span className="text-[#1DB954]">ify</span>
      </h1>
      <p className="max-w-md px-6 text-neutral-400">
        Walk through your music in 3D. Each room is a track from your library —
        lit by its album art.
      </p>
      <button className="btn-spotify" onClick={() => login()}>
        Log in with Spotify
      </button>
      <p className="px-6 text-xs text-neutral-600">
        Requires Spotify Premium for playback.
      </p>
    </div>
  )
}
