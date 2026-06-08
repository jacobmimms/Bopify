import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Vector2 } from 'three'

// Custom infinite grid: a large plane that FOLLOWS the camera and draws grid
// lines in world space inside the fragment shader. Because the plane is always
// under the player, it can never get left behind or frustum-culled — fixing the
// flicker/disappear that drei's finite <Grid> had. Lines are placed at world
// coords ≡ 10 (mod size) so the section lines fall on the column intersections.
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
  uniform vec2 uCam;
  uniform vec3 uMinor;
  uniform vec3 uMajor;
  uniform float uFade;
  // Derivative-based line mask: width tracks the on-screen pixel footprint, so a
  // line is ~1px wide at any distance and fades out cleanly once it can no longer
  // be resolved. No fixed world-space width => no shimmer/moiré as the camera moves.
  float lineMask(vec2 coord, float size) {
    vec2 t = (coord - 10.0) / size;
    vec2 g = fwidth(t);
    vec2 dd = abs(fract(t - 0.5) - 0.5) / max(g, 1e-5);
    return 1.0 - min(min(dd.x, dd.y), 1.0);
  }
  void main() {
    float minor = lineMask(vWorld, 4.0);
    float major = lineMask(vWorld, 20.0);
    float fade = 1.0 - smoothstep(uFade * 0.4, uFade, length(vWorld - uCam));
    if (fade <= 0.0) discard;
    vec3 col = mix(uMinor, uMajor, step(0.5, major));
    float a = max(minor * 0.85, major) * fade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`

export default function GridFloor() {
  const ref = useRef()
  const uniforms = useMemo(
    () => ({
      uCam: { value: new Vector2() },
      uMinor: { value: new Color('#36b06a') }, // brighter minor lines
      uMajor: { value: new Color('#1DB954') },
      uFade: { value: 320 },
    }),
    [],
  )

  useFrame(({ camera }) => {
    if (!ref.current) return
    ref.current.position.x = camera.position.x
    ref.current.position.z = camera.position.z
    uniforms.uCam.value.set(camera.position.x, camera.position.z)
  })

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      frustumCulled={false}
      renderOrder={0}
    >
      <planeGeometry args={[820, 820]} />
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
