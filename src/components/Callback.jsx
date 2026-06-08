import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback } from '../auth/spotify-auth'

// Handles the /callback redirect: exchanges the code for tokens, then sends
// the user back to the experience.
export default function Callback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    handleCallback()
      .then(() => {
        if (!cancelled) navigate('/', { replace: true })
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black text-center text-white">
      {error ? (
        <>
          <p className="text-red-400">Login failed</p>
          <p className="max-w-md px-6 text-sm text-neutral-500">{error}</p>
          <a className="btn-spotify" href="/">
            Try again
          </a>
        </>
      ) : (
        <p className="animate-pulse text-neutral-400">Connecting to Spotify…</p>
      )}
    </div>
  )
}
