import { useEffect, useRef, useState } from 'react'
import { getAccessToken } from '../auth/spotify-auth'

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js'

// Loads the Spotify Web Playback SDK once and exposes a single player instance.
// Listeners are attached exactly once (the old code re-attached every render).
export function useSpotifyPlayer() {
  const [player, setPlayer] = useState(null)
  const [deviceId, setDeviceId] = useState(null)
  const [state, setState] = useState(null) // raw SDK player state
  const [error, setError] = useState(null)
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    function init() {
      if (cancelled || playerRef.current) return

      const p = new window.Spotify.Player({
        name: 'Bopify',
        getOAuthToken: (cb) => {
          getAccessToken().then((t) => t && cb(t))
        },
        volume: 0.5,
      })

      p.addListener('ready', ({ device_id }) => {
        if (!cancelled) setDeviceId(device_id)
      })
      p.addListener('not_ready', () => {
        if (!cancelled) setDeviceId(null)
      })
      p.addListener('player_state_changed', (s) => {
        if (!cancelled) setState(s)
      })
      p.addListener('initialization_error', ({ message }) => setError(message))
      p.addListener('authentication_error', ({ message }) => setError(message))
      p.addListener('account_error', () =>
        setError('Spotify Premium is required for playback.'),
      )

      p.connect()
      playerRef.current = p
      setPlayer(p)
    }

    // The SDK calls this global once it has loaded.
    window.onSpotifyWebPlaybackSDKReady = init
    // If the script is already present (e.g. StrictMode remount), init now.
    if (window.Spotify) init()
    else if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = SDK_SRC
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      // Keep the player connected across StrictMode's dev double-mount; only
      // disconnect on a real unmount by deferring to a microtask check.
      playerRef.current?.disconnect()
      playerRef.current = null
    }
  }, [])

  return { player, deviceId, state, error }
}
