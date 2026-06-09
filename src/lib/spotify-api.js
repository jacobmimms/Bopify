// Thin wrapper over the Spotify Web API (non-deprecated endpoints only).
// Every call is authorized with the PKCE access token and retries once on 401.

import { getAccessToken, refreshAccessToken } from '../auth/spotify-auth'

const BASE = 'https://api.spotify.com/v1'

async function apiFetch(path, options = {}, retry = true) {
  const token = await getAccessToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 401 && retry) {
    // A 401 on a clock-valid token means it was invalidated server-side; force a
    // refresh before retrying rather than resending the same dead token.
    await refreshAccessToken()
    return apiFetch(path, options, false)
  }
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Spotify ${res.status}: ${await res.text()}`)
  return res.json()
}

// --- profile (for search market) -------------------------------------------

let mePromise = null
export function getMe() {
  // Don't cache a failure — clear it so a later call can retry instead of
  // running the whole session with no market.
  if (!mePromise) {
    mePromise = apiFetch('/me').catch(() => {
      mePromise = null
      return null
    })
  }
  return mePromise
}

// --- search: our directional "recommendations" generator --------------------

// Tracks for a given year (+ optional genre). Pages until we have `target` tracks
// or the results run out, advancing offset by the number of items actually
// returned so it works whether the API honours limit=50 or clamps it lower. The
// genre is quoted so multi-word values (e.g. "bossa nova") stay one filter token.
// Deterministic: the same year+genre always yields the same ordered space.
export async function searchTracks(year, genre, market, target = 50) {
  const q = genre ? `genre:"${genre}" year:${year}` : `year:${year}`
  const seen = new Set()
  const out = []
  let offset = 0
  for (let page = 0; page < 5 && out.length < target; page++) {
    const params = new URLSearchParams({
      q,
      type: 'track',
      limit: '50',
      offset: String(offset),
    })
    if (market) params.set('market', market)
    let data
    try {
      data = await apiFetch(`/search?${params}`)
    } catch (e) {
      // A page-0 failure is a real error — surface it so the caller can retry
      // rather than caching this year as (falsely) empty.
      if (page === 0) throw e
      break
    }
    const items = data?.tracks?.items ?? []
    if (items.length === 0) break
    for (const t of items) {
      if (!t?.id || seen.has(t.id)) continue
      if (!t.album?.images?.length || t.is_playable === false) continue
      seen.add(t.id)
      out.push(t)
    }
    offset += items.length
    if (!data?.tracks?.next) break // genuinely no more results
  }
  return out
}

// --- playback ---------------------------------------------------------------

export async function transferPlayback(deviceId, play = false) {
  return apiFetch('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
}

export async function playTrack(deviceId, uri, positionMs = 0) {
  return apiFetch(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
  })
}
