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
  return p
}
