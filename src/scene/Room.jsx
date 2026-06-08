import { useEffect, useMemo } from 'react'
import { Color } from 'three'
import { getPalette } from '../lib/color'

// A room recolours the GRID's minor lines within its cell to the album colour.
// Same world-space line placement as GridFloor (coords ≡ 10 mod 4), drawn on
// top, so the colour reads as part of the grid — not a ring or glow. The 18×18
// patch stays inside the cell so the green section (boundary) lines are kept.
const vert = /* glsl */ `
  varying highp vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const frag = /* glsl */ `
  precision highp float;
  varying highp vec2 vWorld;
  uniform vec3 uColor;
  // Derivative-based line mask (matches GridFloor) — pixel-width lines, no shimmer.
  float lineMask(vec2 coord, float size) {
    vec2 t = (coord - 10.0) / size;
    vec2 g = fwidth(t);
    vec2 dd = abs(fract(t - 0.5) - 0.5) / max(g, 1e-5);
    return 1.0 - min(min(dd.x, dd.y), 1.0);
  }
  void main() {
    float m = lineMask(vWorld, 4.0);
    if (m < 0.02) discard;
    gl_FragColor = vec4(uColor, m);
  }
`

export default function Room({ center, track }) {
  const [x, z] = center
  const url = track?.album?.images?.[0]?.url
  const uniforms = useMemo(() => ({ uColor: { value: new Color('#1DB954') } }), [])

  useEffect(() => {
    let alive = true
    getPalette(url).then((p) => alive && uniforms.uColor.value.set(p.vibrantHex))
    return () => {
      alive = false
    }
  }, [url, uniforms])

  return (
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <planeGeometry args={[18, 18]} />
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}
