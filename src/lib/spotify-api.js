// Thin wrapper over the Spotify Web API (non-deprecated endpoints only).
// Every call is authorized with the PKCE access token and retries once on 401.

import { getAccessToken } from '../auth/spotify-auth'

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

  if (res.status === 401 && retry) return apiFetch(path, options, false)
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Spotify ${res.status}: ${await res.text()}`)
  return res.json()
}

// --- profile (for search market) -------------------------------------------

let mePromise = null
export function getMe() {
  if (!mePromise) mePromise = apiFetch('/me').catch(() => null)
  return mePromise
}

// --- search: our directional "recommendations" generator --------------------

// Tracks for a given year (+ optional genre). Search silently CLAMPS limit to
// 10, so we page with offset to gather up to ~30. Deterministic: the same
// year+genre always yields the same space.
export async function searchTracks(year, genre, market, pages = 3) {
  const q = genre ? `genre:${genre} year:${year}` : `year:${year}`
  const seen = new Set()
  const out = []
  for (let p = 0; p < pages; p++) {
    const params = new URLSearchParams({
      q,
      type: 'track',
      limit: '10',
      offset: String(p * 10),
    })
    if (market) params.set('market', market)
    let data
    try {
      data = await apiFetch(`/search?${params}`)
    } catch {
      break
    }
    const items = data?.tracks?.items ?? []
    for (const t of items) {
      if (!t?.id || seen.has(t.id)) continue
      if (!t.album?.images?.length || t.is_playable === false) continue
      seen.add(t.id)
      out.push(t)
    }
    if (!data?.tracks?.next) break // no more pages
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
