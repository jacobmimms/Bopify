// Loads an album image once (cached by URL) so it can be composited onto a
// column's cylindrical surface via a canvas texture.
const cache = new Map() // url -> Promise<HTMLImageElement>

export function getAlbumImage(url) {
  if (!url) return Promise.reject(new Error('no url'))
  if (cache.has(url)) return cache.get(url)
  const p = new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
  cache.set(url, p)
  // Don't let a transient load failure poison the cache forever — drop the
  // rejected entry so a later visit retries.
  p.catch(() => {
    if (cache.get(url) === p) cache.delete(url)
  })
  return p
}
