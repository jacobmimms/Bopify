import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { MeshStandardMaterial } from 'three'
import Room from './Room'
import InstancedColumns from './InstancedColumns'
import AlbumColumn from './AlbumColumn'
import Bust from './Bust'
import GridFloor from './GridFloor'
import Sky from './Sky'
import { getPalette } from '../lib/color'
import { getAlbumImage } from '../lib/textures'
import { searchTracks, playTrack, transferPlayback, getMe } from '../lib/spotify-api'

const ROOM = 20
const HALF = ROOM / 2
// Colonnade window: deep toward older years (−Z / the mountains), narrow in X,
// and clamped to the valid year band so the empty future/past stay open plains.
const COL_W = 9 // half-width in X
const COL_FWD = 45 // cells toward older years (−Z), up to the mountain foothills
const COL_BACK = 8 // cells toward newer years (+Z)
const CAPACITY = (2 * COL_W + 1) * (COL_FWD + COL_BACK + 1)
const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1850

const key = (i, j) => `${i},${j}`
// deterministic per-cell pseudo-random for scattering busts in rooms
const rnd = (i, j) => {
  const s = Math.sin(i * 45.13 + j * 91.7) * 43758.5453
  return s - Math.floor(s)
}
const cellOf = (p) => [Math.round(p.x / ROOM), Math.round(p.z / ROOM)]
const cellCenter = (i, j) => [i * ROOM, j * ROOM]
const wrap = (n, len) => ((n % len) + len) % len
const yearForRow = (j) => {
  const y = CURRENT_YEAR + j
  return y < MIN_YEAR || y > CURRENT_YEAR ? null : y
}

// Each room projects 4 vertical album slices onto its 4 corner columns. For a
// corner column, `region` is the quarter-arc of that round column's shaft facing
// the room (U=0 faces +Z, increasing toward +X), and `slice` is which vertical
// quarter of the album it shows (0=leftmost). Slices go clockwise TL→TR→BR→BL.
const CORNERS = [
  { o: [-HALF, -HALF], region: 0, slice: 0 }, // TL column (arc faces +x,+z)
  { o: [HALF, -HALF], region: 3, slice: 1 }, // TR column (arc faces -x,+z)
  { o: [HALF, HALF], region: 2, slice: 2 }, // BR column (arc faces -x,-z)
  { o: [-HALF, HALF], region: 1, slice: 3 }, // BL column (arc faces +x,-z)
]

export default function World({ controller, deviceId, player, genre, onMeta }) {
  const cameraRef = useRef()
  const sunRef = useRef()
  const rows = useRef(new Map()) // year -> tracks[]
  const loading = useRef(new Set())
  const market = useRef(undefined)
  const visited = useRef(new Map()) // cellKey -> track (persists)
  const positions = useRef(new Map()) // cellKey -> last playback position (ms)
  const currentId = useRef(null)
  const playingCell = useRef(null)
  const playTimer = useRef(null)
  const transferred = useRef(false)
  const lastMetaId = useRef('__init__') // skip redundant onMeta/accent work
  const genreInit = useRef(true)
  // Incremental scene structures (built O(1) per room, not re-aggregated O(N)).
  const roomsList = useRef([]) // [{ k, center, track }]
  const albumColMap = useRef(new Map()) // colKey -> { position, contribs }

  const [playerCell, setPlayerCell] = useState([0, 0])
  const [version, setVersion] = useState(0)
  const [roomVersion, setRoomVersion] = useState(0) // bumps only when a room is added
  const [marketReady, setMarketReady] = useState(false)
  const [accent, setAccent] = useState('#ff3d7f') // current album colour for the backdrop
  const [title, setTitle] = useState('') // current track title, printed on the sun

  // Lit white stone so columns self-shade (form) and read as solid material.
  const stone = useMemo(
    () => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }),
    [],
  )

  function ensureRow(year) {
    if (year == null || rows.current.has(year) || loading.current.has(year)) return
    loading.current.add(year)
    searchTracks(year, genre, market.current)
      .then((tracks) => {
        rows.current.set(year, tracks)
        setVersion((v) => v + 1)
      })
      .catch(() => { })
      .finally(() => loading.current.delete(year))
  }

  const trackForCell = (i, j) => {
    const year = yearForRow(j)
    if (year == null) return null
    const k = key(i, j)
    if (visited.current.has(k)) return visited.current.get(k)
    const tracks = rows.current.get(year)
    if (!tracks?.length) return null
    return tracks[wrap(i, tracks.length)]
  }

  // Add a room + its 4 album-column contributions incrementally (O(1)).
  function materialize(i, j, track) {
    visited.current.set(key(i, j), track)
    const [cx, cz] = cellCenter(i, j)
    roomsList.current.push({ k: key(i, j), center: [cx, cz], track })
    const url = track.album?.images?.[0]?.url
    if (url) {
      for (const { o, region, slice } of CORNERS) {
        const ck = `${cx + o[0]}_${cz + o[1]}`
        let entry = albumColMap.current.get(ck)
        if (!entry) {
          entry = { position: [cx + o[0], 0, cz + o[1]], contribs: [] }
          albumColMap.current.set(ck, entry)
        }
        entry.contribs.push({ region, slice, url })
      }
    }
    setRoomVersion((v) => v + 1)
  }

  useEffect(() => {
    getMe()
      .then((me) => {
        market.current = me?.country || undefined
      })
      .finally(() => setMarketReady(true))
  }, [])

  useEffect(() => {
    if (deviceId && !transferred.current) {
      transferred.current = true
      transferPlayback(deviceId, false).catch(() => { })
    }
  }, [deviceId])

  // Genre change: reset the explorable state IN PLACE and reseed at the player's
  // CURRENT cell/year (no teleport). The static scene (Sky, grid, column
  // geometry) stays mounted, so there's no expensive rebuild — only the dynamic
  // rooms/columns clear and refill for the new genre.
  useEffect(() => {
    if (genreInit.current) {
      genreInit.current = false
      return
    }
    rows.current.clear()
    loading.current.clear()
    visited.current.clear()
    positions.current.clear()
    roomsList.current = []
    albumColMap.current = new Map()
    currentId.current = null
    playingCell.current = null
    lastMetaId.current = '__init__'
    clearTimeout(playTimer.current)
    player?.pause()?.catch?.(() => {})
    setAccent('#ff3d7f')
    setPlayerCell(cellOf(controller.state.position))
    setRoomVersion((v) => v + 1)
    setVersion((v) => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre])

  // Cancel any pending play on unmount (logout) so it can't fire late.
  useEffect(() => () => clearTimeout(playTimer.current), [])

  // Prefetch the neighbouring year-rows + album art so transitions are instant.
  useEffect(() => {
    if (!marketReady) return
    const [pi, pj] = playerCell
    for (let dj = -1; dj <= 1; dj++) ensureRow(yearForRow(pj + dj))
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const t = trackForCell(pi + di, pj + dj)
        const url = t?.album?.images?.[0]?.url
        if (url) {
          getAlbumImage(url).catch(() => { })
          getPalette(url)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCell, version, marketReady])

  // STRICT room-bound playback + resume-where-you-left.
  useEffect(() => {
    if (!marketReady || !deviceId) return
    const [i, j] = playerCell
    const k = key(i, j)
    const year = yearForRow(j)

    let track = null
    if (year != null) {
      ensureRow(year)
      track = visited.current.get(k)
      if (!track) {
        const t = trackForCell(i, j)
        if (t) {
          track = t
          materialize(i, j, t) // adds room + album columns, bumps roomVersion
        }
      }
    }

    // empty = this year+genre loaded with zero tracks (whole year band is bare).
    const empty = year != null && rows.current.has(year) && !rows.current.get(year)?.length
    // Only touch HUD/backdrop when the track (or empty/loading state) changes.
    const metaId = track ? track.id : `none:${year}:${empty ? 'e' : 'l'}`
    if (metaId !== lastMetaId.current) {
      lastMetaId.current = metaId
      onMeta?.({ track: track || null, year, empty })
      setTitle(track ? track.name : '')
      if (track) {
        getPalette(track.album?.images?.[0]?.url).then((p) => setAccent(p.vibrantHex))
      }
    }

    clearTimeout(playTimer.current)
    if (track && track.id === currentId.current) return
    pauseNow()
    if (track) playTimer.current = setTimeout(() => playSafely(track, k), 220)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCell, version, marketReady, deviceId])

  function pauseNow() {
    if (currentId.current === null) return
    const leaving = playingCell.current
    currentId.current = null
    playingCell.current = null
    if (!player) return
    // capture position so we resume this room where we left off
    player
      .getCurrentState()
      .then((s) => {
        if (s && leaving) positions.current.set(leaving, s.position)
      })
      .catch(() => { })
      .finally(() => player.pause()?.catch?.(() => { }))
  }

  async function playSafely(track, cellKey) {
    if (!deviceId) return
    currentId.current = track.id
    playingCell.current = cellKey
    const pos = positions.current.get(cellKey) || 0
    try {
      await playTrack(deviceId, track.uri, pos)
    } catch {
      try {
        await transferPlayback(deviceId, false)
        await playTrack(deviceId, track.uri, pos)
      } catch {
        currentId.current = null
        playingCell.current = null
      }
    }
  }

  // Rooms + album columns read straight from the incremental refs (rebuilt only
  // when a room is actually added, not on every row-load).
  const rooms = useMemo(
    () => roomsList.current.slice(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomVersion],
  )

  const albumColumns = useMemo(
    () => [...albumColMap.current.values()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomVersion],
  )

  // Plain colonnade field, excluding positions that are album columns. Looks up
  // the album map directly (no O(N) Set rebuild per change).
  const fieldPositions = useMemo(() => {
    const [pi, pj] = playerCell
    const minJ = MIN_YEAR - CURRENT_YEAR // oldest valid cell
    const bMin = Math.max(pj - COL_FWD, minJ)
    const bMax = Math.min(pj + COL_BACK, 0) // nothing in the empty future
    const out = []
    for (let a = pi - COL_W; a <= pi + COL_W; a++) {
      for (let b = bMin; b <= bMax; b++) {
        const x = a * ROOM + HALF
        const z = b * ROOM + HALF
        if (!albumColMap.current.has(`${x}_${z}`)) out.push([x, z])
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCell, roomVersion])

  useFrame((_, delta) => {
    controller.update(delta)
    const cam = cameraRef.current
    if (!cam) return
    const s = controller.state
    cam.position.set(s.position.x, s.position.y + s.bobY, s.position.z)
    cam.rotation.order = 'YXZ'
    cam.rotation.set(s.pitch, s.yaw, 0)

    // Key light comes FROM the sun (-Z) so columns are lit warm on the sunset
    // side and fall into shadow on the back. Frustum stays centred on the player.
    const sun = sunRef.current
    if (sun) {
      // Snap the shadow frustum to texel increments (180-unit span / 2048 map) so
      // shadow edges don't swim/crawl as the player moves continuously.
      const STEP = 180 / 2048
      const sx = Math.round(s.position.x / STEP) * STEP
      const sz = Math.round(s.position.z / STEP) * STEP
      sun.position.set(sx + 20, 75, sz - 300)
      sun.target.position.set(sx, 0, sz)
      sun.target.updateMatrixWorld()
    }
    if (Math.abs(cam.fov - s.fov) > 0.01) {
      cam.fov = s.fov
      cam.updateProjectionMatrix()
    }

    const [ci, cj] = cellOf(cam.position)
    if (ci !== playerCell[0] || cj !== playerCell[1]) setPlayerCell([ci, cj])
  })

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={72} near={0.5} far={2600} />
      {/* Atmospheric haze: distant columns dissolve into the horizon before they
          shrink to sub-pixel slivers, which kills the far-column shimmer and adds
          depth. Sky dome + mountains opt out (fog={false}) so they stay crisp. */}
      <fogExp2 attach="fog" args={['#160c28', 0.0015]} />
      {/* dim cool fill so shadowed sides aren't black (sky bounce) */}
      <ambientLight intensity={0.2} />
      <hemisphereLight args={['#4a3a6e', '#0a0d16', 0.35]} />
      {/* warm sunset key light from the sun — casts shadows; floor is unlit so no glow */}
      <directionalLight
        ref={sunRef}
        intensity={2.1}
        color="#ffcf8a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      {/* dim outrun rim light from the moon's direction (behind-right, off-axis
          so the terminator isn't a clean half). No shadow map — the sun owns
          shadows. Just tints the back of the columns pink/purple. */}
      <directionalLight intensity={0.6} color="#b29cd0" position={[300, 168, 72]} />
      <Sky accent={accent} title={title} />

      {/* unlit floor base — no light source can glow it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial color="#0a0716" />
      </mesh>
      {/* shadow catcher — only darkens where columns cast, no lighting/glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <shadowMaterial transparent opacity={0.5} />
      </mesh>

      <GridFloor />

      <InstancedColumns positions={fieldPositions} capacity={CAPACITY} material={stone} />

      {albumColumns.map((c) => (
        <AlbumColumn
          key={`${c.position[0]}_${c.position[2]}`}
          position={c.position}
          contribs={c.contribs}
          stone={stone}
          playerCell={playerCell}
        />
      ))}

      {rooms.map((r) => {
        const [i, j] = r.k.split(',').map(Number)
        return (
          <group key={r.k}>
            <Room center={r.center} track={r.track} />
            <Suspense fallback={null}>
              <Bust
                position={[
                  r.center[0] + (rnd(i + 7, j) - 0.5) * 9,
                  r.center[1] + (rnd(i, j + 7) - 0.5) * 9,
                ]}
                rotation={rnd(i + 3, j + 3) * Math.PI * 2}
                pedestalMat={stone}
              />
            </Suspense>
          </group>
        )
      })}
    </>
  )
}
