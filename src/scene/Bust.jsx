import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

// Real marble bust (Poly Haven, CC0). The model is ~0.5 units tall, so we scale
// it up and sit it on a small stone pedestal. Cloned per instance (geometry +
// textures are shared, so it's cheap) and shadow-enabled.
const URL = '/models/marble_bust/marble_bust_01_4k.gltf'
useGLTF.preload(URL)

// Floating stepped-pyramid base: 5 square slabs that shrink going up, each
// separated by a gap so they appear to levitate.
const SLAB_H = 0.03
const GAP = 0.02
const baseLayers = Array.from({ length: 10 }, (_, i) => ({
  size: (0.26 - i * 0.04) - .06, // 0.42 → 0.18
  y: i * (SLAB_H + GAP) + SLAB_H / 2,
}))
const PYRAMID_TOP = 9 * (SLAB_H + GAP) + SLAB_H // ≈ 0.25

// ~0.2-unit bust (about the size of the camera's "head") on a tiny plinth.
export default function Bust({ position, rotation = 0, scale = 0.4, pedestalMat }) {
  const { scene } = useGLTF(URL)
  const model = useMemo(() => {
    const m = scene.clone(true)
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return m
  }, [scene])

  const [x, z] = position
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      {/* floating stepped-pyramid base */}
      {baseLayers.map((l, i) => (
        <mesh key={i} position={[0, l.y, 0]} material={pedestalMat} castShadow receiveShadow>
          <boxGeometry args={[l.size, SLAB_H, l.size]} />
        </mesh>
      ))}
      <primitive object={model} scale={scale} position={[0, PYRAMID_TOP, 0]} />
    </group>
  )
}
