import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars, Billboard } from '@react-three/drei'
import { BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide } from 'three'

// Draws the song title to a canvas and maps it onto a plane on the sun's upper
// band. Muted maroon, auto-shrinks to fit, opts out of fog so it stays crisp at
// the sun's distance — reads as a printed stripe rather than popping out.
const fullwidth = (s) =>
  [...(s || '')]
    .map((c) => {
      const n = c.charCodeAt(0)
      if (n === 0x20) return '　'
      if (n >= 0x21 && n <= 0x7e) return String.fromCharCode(n + 0xfee0)
      return c
    })
    .join('')

function SunTitle({ title }) {
  const tex = useMemo(() => {
    const W = 1024
    const H = 150
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    const family = '"Helvetica Neue", Arial, sans-serif'
    const text = fullwidth((title || '').toLowerCase())
    let size = 64
    ctx.font = `500 ${size}px ${family}`
    while (ctx.measureText(text).width > W - 70 && size > 22) {
      size -= 3
      ctx.font = `500 ${size}px ${family}`
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ff8f6b' // the sun's colour → reads like the sun showing through
    ctx.fillText(text, W / 2, H / 2)
    const t = new CanvasTexture(canvas)
    t.needsUpdate = true
    return t
  }, [title])

  return (
    <mesh position={[0, 5, 1]}>
      <planeGeometry args={[240, 35]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  )
}

// Synthwave backdrop: gradient dome (warmer toward the sun, darker away),
// starfield, a banded sun with a soft aura, and a jagged mountain RING that
// wraps the whole horizon between the world and the sun. Mountains have black
// faces + edges that glow the album colour; their base sits below the floor so
// there's no visible bottom edge. The group follows the player (infinitely far).

const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const domeFrag = /* glsl */ `
  precision mediump float;
  varying vec3 vDir;
  uniform vec3 cTop; uniform vec3 cHorizonSun; uniform vec3 cHorizonFar; uniform vec3 cGround;
  void main() {
    vec3 d = normalize(vDir);
    float up = d.y;
    vec2 hz = normalize(vec2(d.x, d.z) + 1e-5);
    float sw = clamp(-hz.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 horizon = mix(cHorizonFar, cHorizonSun, sw);
    vec3 col = up >= 0.0
      ? mix(horizon, cTop, pow(up, 0.5))
      : mix(horizon, cGround, clamp(-up * 3.0, 0.0, 1.0));
    float aura = pow(sw, 6.0) * (1.0 - clamp(up * 6.0, 0.0, 1.0));
    col += cHorizonSun * aura * 0.16;   // subtler glow
    gl_FragColor = vec4(col, 1.0);
  }
`

const sunVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const sunFrag = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform vec3 cTop; uniform vec3 cBot;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float disc = 0.6;
    if (r <= disc) {
      float t = (p.y / disc) * 0.5 + 0.5;
      vec3 col = mix(cBot, cTop, t);
      // retro stripes in the lower half — soften the band edges so they don't alias
      if (t < 0.55) {
        float f = fract((0.55 - t) * 9.0);
        float aa = clamp(fwidth(t) * 9.0, 0.0001, 0.49);
        gl_FragColor = vec4(col, smoothstep(0.45 - aa, 0.45 + aa, f));
      } else {
        gl_FragColor = vec4(col, 1.0);
      }
    } else {
      float glow = pow(smoothstep(1.0, disc, r), 2.2) * 0.32;
      gl_FragColor = vec4(mix(cBot, cTop, 0.6) * glow, glow);
    }
  }
`

// Flat moon with a slight gradient + venetian stripes MIRRORED from the sun:
// the sun's bands are in its lower half, the moon's are in its UPPER half.
const moonFrag = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform vec3 cCore; uniform vec3 cEdge;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float disc = 0.6;
    if (r <= disc) {
      float t = (p.y / disc) * 0.5 + 0.5;           // 0 bottom .. 1 top
      vec3 col = mix(cEdge, cCore, 0.45 + t * 0.35); // slight gradient
      if (t > 0.45) {                                // upper half — mirrored stripes
        float f = fract((t - 0.45) * 9.0);
        float aa = clamp(fwidth(t) * 9.0, 0.0001, 0.49);
        gl_FragColor = vec4(col, smoothstep(0.45 - aa, 0.45 + aa, f));
      } else {
        gl_FragColor = vec4(col, 1.0);
      }
    } else {
      float glow = pow(smoothstep(1.0, disc, r), 3.0) * 0.1; // faint halo
      gl_FragColor = vec4(cCore * glow, glow);
    }
  }
`

const mtnVert = /* glsl */ `
  attribute vec3 bary;
  varying vec3 vBary;
  void main() { vBary = bary; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const mtnFrag = /* glsl */ `
  precision mediump float;
  varying vec3 vBary;
  uniform vec3 uColor;
  uniform float uDim;
  void main() {
    float d = min(min(vBary.x, vBary.y), vBary.z);
    // pixel-width edge via screen-space derivative — no sparkle on the far ridges
    float aa = fwidth(d);
    float line = 1.0 - smoothstep(0.0, aa * 1.5, d);
    float glow = exp(-d * 45.0) * 0.4;
    gl_FragColor = vec4(uColor * (line + glow) * uDim, 1.0); // black faces, glowing wire
  }
`

function hash(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// 2D ridged value noise -> 0..1, broad features for big mountains.
function ridgedHeight(x, z) {
  let amp = 1
  let freq = 0.005
  let sum = 0
  let norm = 0
  for (let o = 0; o < 4; o++) {
    let n = vnoise(x * freq, z * freq)
    n = 1 - Math.abs(2 * n - 1)
    sum += n * amp
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum / norm
}

// Classic synthwave terrain: a WIDE heightfield strip in front of the player
// (toward the sun / older years). The ground is flat near you and ramps up with
// distance into a far mountain range — so it reads as the ground rising into the
// mountains rather than a close wall. Sides taper to 0. Black opaque faces (the
// sun rises behind/through the peaks) + glowing wireframe edges.
function buildStrip() {
  const WIDTH = 5000
  const ZNEAR = -400
  const ZFAR = -800
  const AX = 900
  const AZ = 64
  const at = (xi, zi) => {
    const x = -WIDTH + (2 * WIDTH * xi) / AX
    const z = ZNEAR + ((ZFAR - ZNEAR) * zi) / AZ
    const ramp = smoothstep(ZNEAR, -1050, z) // 0 near (flat) .. 1 (mountains); steeper rise
    const xenv = 1 - smoothstep(1150, WIDTH, Math.abs(x))
    return [x, ridgedHeight(x, z) * 360 * ramp * xenv, z]
  }
  const verts = []
  for (let xi = 0; xi < AX; xi++) {
    for (let zi = 0; zi < AZ; zi++) {
      const a = at(xi, zi)
      const b = at(xi + 1, zi)
      const c = at(xi, zi + 1)
      const d = at(xi + 1, zi + 1)
      verts.push(...a, ...b, ...c, ...b, ...d, ...c)
    }
  }
  const arr = new Float32Array(verts)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(arr, 3))
  const n = arr.length / 3
  const bary = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) bary[i * 3 + (i % 3)] = 1
  geo.setAttribute('bary', new BufferAttribute(bary, 3))
  return geo
}

export default function Sky({ accent = '#ff3d7f', title = '' }) {
  const group = useRef()

  const domeUniforms = useMemo(
    () => ({
      cTop: { value: new Color('#0c0720') },
      cHorizonSun: { value: new Color('#8e2a54') },
      cHorizonFar: { value: new Color('#130a26') },
      cGround: { value: new Color('#08040f') },
    }),
    [],
  )
  const sunUniforms = useMemo(
    () => ({ cTop: { value: new Color('#ffd86b') }, cBot: { value: new Color('#ff3d7f') } }),
    [],
  )
  const moonUniforms = useMemo(
    () => ({ cCore: { value: new Color('#e7e0ec') }, cEdge: { value: new Color('#564a6b') } }),
    [],
  )
  const mtnUniforms = useMemo(
    () => ({ uColor: { value: new Color(accent) }, uDim: { value: 1.0 } }),
    [],
  )
  const mtnGeo = useMemo(buildStrip, [])

  useEffect(() => {
    mtnUniforms.uColor.value.set(accent)
  }, [accent, mtnUniforms])

  useFrame(({ camera }) => {
    if (group.current) {
      group.current.position.x = camera.position.x
      group.current.position.z = camera.position.z
    }
  })

  return (
    <group ref={group}>
      <mesh renderOrder={-10}>
        <sphereGeometry args={[2300, 32, 16]} />
        <shaderMaterial
          vertexShader={domeVert}
          fragmentShader={domeFrag}
          uniforms={domeUniforms}
          side={BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      <Stars radius={600} depth={80} count={1500} factor={6} saturation={0} fade speed={0} />

      {/* moon — high and off to the right side */}
      <Billboard position={[1750, 980, 420]}>
        <mesh>
          <planeGeometry args={[380, 380]} />
          <shaderMaterial
            vertexShader={sunVert}
            fragmentShader={moonFrag}
            uniforms={moonUniforms}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </Billboard>

      <Billboard position={[0, 360, -1700]}>
        <mesh>
          <planeGeometry args={[820, 820]} />
          <shaderMaterial
            vertexShader={sunVert}
            fragmentShader={sunFrag}
            uniforms={sunUniforms}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
        {title && <SunTitle title={title} />}
      </Billboard>

      {/* terrain: flat near you, rising into distant mountains */}
      <mesh geometry={mtnGeo}>
        <shaderMaterial
          vertexShader={mtnVert}
          fragmentShader={mtnFrag}
          uniforms={mtnUniforms}
          side={DoubleSide}
          fog={false}
        />
      </mesh>
    </group>
  )
}
