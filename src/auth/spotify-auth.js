// Spotify Authorization Code flow with PKCE — runs entirely in the browser.
// No backend, no client secret. Tokens live in localStorage and auto-refresh.
//
// Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'

// Everything we need: playback control + reading the user's own library.
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-top-read',
  'user-library-read',
  'playlist-read-private',
].join(' ')

const STORAGE_KEY = 'bopify_auth'
const VERIFIER_KEY = 'bopify_pkce_verifier'
const STATE_KEY = 'bopify_oauth_state'

// Redirect URI must EXACTLY match one registered in the Spotify dashboard.
function redirectUri() {
  return `${window.location.origin}/callback`
}

// --- PKCE helpers -----------------------------------------------------------

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// --- token storage ----------------------------------------------------------

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

function store(tokens) {
  // tokens: { access_token, refresh_token, expires_in }
  const expires_at = Date.now() + tokens.expires_in * 1000
  const existing = readStored() || {}
  const next = {
    access_token: tokens.access_token,
    // Spotify may omit refresh_token on refresh; keep the old one.
    refresh_token: tokens.refresh_token || existing.refresh_token,
    expires_at,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function isLoggedIn() {
  return !!readStored()?.refresh_token
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(VERIFIER_KEY)
  localStorage.removeItem(STATE_KEY)
}

// --- public flow ------------------------------------------------------------

// Step 1: kick off login. Generates a verifier, stores it, and redirects.
export async function login() {
  if (!CLIENT_ID) {
    throw new Error('Missing VITE_SPOTIFY_CLIENT_ID — set it in .env.local')
  }
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = base64UrlEncode(await sha256(verifier))

  // CSRF protection: a random state echoed back on /callback and verified there.
  const state = randomString(32)
  localStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })
  window.location.assign(`${AUTH_ENDPOINT}?${params}`)
}

// Step 2: on /callback, exchange the code for tokens.
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  if (error) throw new Error(`Spotify auth error: ${error}`)

  const code = params.get('code')
  if (!code) throw new Error('No authorization code in callback URL')

  const returnedState = params.get('state')
  const expectedState = localStorage.getItem(STATE_KEY)
  localStorage.removeItem(STATE_KEY)
  if (!expectedState || returnedState !== expectedState) {
    throw new Error('State mismatch — possible CSRF, restart login')
  }

  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('Missing PKCE verifier — restart login')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)

  localStorage.removeItem(VERIFIER_KEY)
  store(await res.json())
}

let refreshPromise = null

// Step 3: get a valid access token, refreshing transparently when expired.
export async function getAccessToken() {
  const stored = readStored()
  if (!stored?.refresh_token) return null

  // Still valid (with a 60s safety margin)? Use it.
  if (stored.access_token && Date.now() < stored.expires_at - 60_000) {
    return stored.access_token
  }

  // De-duplicate concurrent refreshes.
  if (!refreshPromise) {
    refreshPromise = doRefresh(stored.refresh_token).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// Force a refresh regardless of the clock — used to recover from a 401 on a token
// Spotify invalidated before its stated expiry. De-duped against getAccessToken's
// concurrent refreshes via the shared refreshPromise.
export async function refreshAccessToken() {
  const stored = readStored()
  if (!stored?.refresh_token) return null
  if (!refreshPromise) {
    refreshPromise = doRefresh(stored.refresh_token).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(refresh_token) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    // Refresh token revoked/expired — force a fresh login.
    logout()
    return null
  }
  return store(await res.json()).access_token
}
