import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D } from 'three'

// The bulk colonnade: round Greek columns (plinth → base → fluted shaft →
// echinus → abacus) as 5 InstancedMeshes (5 draw calls for the whole field).
// Capacity is fixed; only `count` + matrices change as the field re-centres on
// the player, so there's no mesh churn. Album columns near visited rooms are
// rendered separately (see AlbumColumn) and excluded from `positions`.
const PARTS = [
  { y: 0.25, box: [2.6, 0.5, 2.6] }, // plinth
  { y: 0.75, cyl: [1.05, 1.2, 0.6, 16] }, // base
  { y: 4.4, cyl: [0.78, 0.95, 6.7, 16] }, // shaft
  { y: 7.95, cyl: [1.1, 0.82, 0.5, 16] }, // echinus
  { y: 8.35, box: [2.2, 0.4, 2.2] }, // abacus
]

export default function InstancedColumns({ positions, capacity, material }) {
  const refs = useRef([])
  const dummy = useMemo(() => new Object3D(), [])
  const count = positions.length

  useLayoutEffect(() => {
    for (let p = 0; p < PARTS.length; p++) {
      const mesh = refs.current[p]
      if (!mesh) continue
      for (let i = 0; i < count; i++) {
        dummy.position.set(positions[i][0], PARTS[p].y, positions[i][1])
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    }
  }, [positions, count, dummy])

  return PARTS.map((part, p) => (
    <instancedMesh
      key={p}
      ref={(el) => (refs.current[p] = el)}
      args={[undefined, undefined, capacity]}
      material={material}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      {part.box ? <boxGeometry args={part.box} /> : <cylinderGeometry args={part.cyl} />}
    </instancedMesh>
  ))
}
