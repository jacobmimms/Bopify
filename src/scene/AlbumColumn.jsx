import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { getAlbumImage } from '../lib/textures'

// A round Greek column at a grid intersection whose ACTUAL shaft cylinder is
// textured with album art. The album is cut into vertical slices (full height,
// quarter width) — a shape that maps onto a tall column far better than a square
// quadrant. The shaft's circumference is split into 4 quarter-arcs; each
// adjacent room paints its slice onto the arc facing it. Cylinder UV: U=0 faces
// +Z and increases toward +X, so quarter-arc `region` r covers U∈[r/4,(r+1)/4].
const STONE = '#ffffff'
const W = 512
const H = 256
const ROOM = 20
// Only the nearest columns get textured — beyond this the album art isn't legible
// anyway, so far columns stay plain stone and the textures pop in/out as you walk.
const TEXTURE_RADIUS = 8 // rooms (Chebyshev → 17×17-cell square around the player)

export default function AlbumColumn({ position, contribs, stone, playerCell }) {
  const gl = useThree((s) => s.gl)
  const [shaftMat, setShaftMat] = useState(null)

  // Chebyshev distance (in rooms) from the player to this column.
  const near =
    Math.max(
      Math.abs(position[0] - playerCell[0] * ROOM),
      Math.abs(position[2] - playerCell[1] * ROOM),
    ) <=
    TEXTURE_RADIUS * ROOM

  useEffect(() => {
    if (!near) {
      setShaftMat(null)
      return
    }
    let alive = true
    let tex
    let mat
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = STONE
    ctx.fillRect(0, 0, W, H)

    Promise.all(
      contribs.map(async ({ region, slice, url }) => {
        try {
          const img = await getAlbumImage(url)
          const sw = img.width / 4
          // source: vertical slice `slice`; dest: quarter-arc `region`
          ctx.drawImage(img, slice * sw, 0, sw, img.height, region * (W / 4), 0, W / 4, H)
        } catch {
          /* leave stone fill */
        }
      }),
    ).then(() => {
      if (!alive) return
      tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      // Anisotropic filtering: album art wraps a cylinder viewed at steep grazing
      // angles, where trilinear alone smears it. This keeps it crisp, not aliased.
      tex.anisotropy = gl.capabilities.getMaxAnisotropy()
      tex.needsUpdate = true
      mat = new MeshStandardMaterial({ map: tex, roughness: 0.8 })
      setShaftMat(mat)
    })

    return () => {
      alive = false
      tex?.dispose()
      mat?.dispose()
    }
  }, [contribs, near, gl])

  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.5, 2.6]} />
      </mesh>
      <mesh position={[0, 0.75, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.2, 0.6, 16]} />
      </mesh>
      {/* the actual shaft mesh, textured with the album slices */}
      <mesh position={[0, 4.4, 0]} material={shaftMat || stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.95, 6.7, 24]} />
      </mesh>
      <mesh position={[0, 7.95, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 0.82, 0.5, 16]} />
      </mesh>
      <mesh position={[0, 8.35, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.4, 2.2]} />
      </mesh>
    </group>
  )
}
