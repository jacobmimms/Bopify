// Extract a colour palette from an album cover so each room can be lit by its
// artwork. Pure browser: draw the image to a small offscreen canvas and sample
// pixels. Results are cached per URL.

const cache = new Map()

const FALLBACK = {
  hex: '#1DB954',
  rgb: [29, 185, 84],
  vibrant: [29, 185, 84],
  vibrantHex: '#1DB954',
}

export function getPalette(url) {
  if (!url) return Promise.resolve(FALLBACK)
  if (cache.has(url)) return cache.get(url)

  const promise = new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // required to read pixels from the CDN
    img.onload = () => {
      try {
        resolve(samplePalette(img))
      } catch {
        resolve(FALLBACK) // tainted canvas / decode error
      }
    }
    img.onerror = () => resolve(FALLBACK)
    img.src = url
  })

  cache.set(url, promise)
  return promise
}

function samplePalette(img) {
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  let rSum = 0
  let gSum = 0
  let bSum = 0
  let count = 0

  // Track the most "vibrant" pixel (high saturation, mid-high brightness).
  let bestScore = -1
  let vibrant = FALLBACK.vibrant

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    rSum += r
    gSum += g
    bSum += b
    count++

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    const score = sat * (max / 255) * (1 - Math.abs(max / 255 - 0.6))
    if (score > bestScore) {
      bestScore = score
      vibrant = [r, g, b]
    }
  }

  const rgb = [
    Math.round(rSum / count),
    Math.round(gSum / count),
    Math.round(bSum / count),
  ]
  return { hex: rgbToHex(rgb), rgb, vibrant, vibrantHex: rgbToHex(vibrant) }
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
