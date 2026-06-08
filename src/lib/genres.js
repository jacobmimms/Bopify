// Genres verified to return tracks via `GET /search?q=genre:…` (US market),
// curated from Spotify's old recommendation seed list. Moods/contexts and tags
// that returned nothing were dropped; `bossanova`→`bossa nova` and
// `philippines-opm`→`opm` were remapped to the strings the catalog actually uses.
export const GENRES = [
  'acoustic', 'afrobeat', 'alt-rock', 'alternative', 'ambient', 'anime',
  'black-metal', 'bluegrass', 'blues', 'bossa nova', 'brazil', 'breakbeat',
  'british', 'cantopop', 'chicago-house', 'children', 'chill', 'classical',
  'club', 'comedy', 'country', 'dance', 'dancehall', 'death-metal', 'deep-house',
  'detroit-techno', 'disco', 'dub', 'dubstep', 'edm', 'electro', 'electronic',
  'emo', 'folk', 'forro', 'french', 'funk', 'garage', 'german', 'gospel', 'goth',
  'grindcore', 'groove', 'grunge', 'guitar', 'happy', 'hard-rock', 'hardcore',
  'hardstyle', 'heavy-metal', 'hip-hop', 'honky-tonk', 'house', 'idm', 'indian',
  'indie', 'indie-pop', 'industrial', 'iranian', 'j-dance', 'j-idol', 'j-pop',
  'j-rock', 'jazz', 'k-pop', 'kids', 'latin', 'latino', 'malay', 'mandopop',
  'metal', 'metalcore', 'minimal-techno', 'mpb', 'new-age', 'opera', 'opm',
  'pagode', 'party', 'piano', 'pop', 'pop-film', 'power-pop', 'progressive-house',
  'psych-rock', 'punk', 'punk-rock', 'r-n-b', 'reggae', 'rock', 'rock-n-roll',
  'rockabilly', 'romance', 'sad', 'salsa', 'samba', 'sertanejo', 'show-tunes',
  'singer-songwriter', 'ska', 'sleep', 'songwriter', 'soul', 'spanish', 'swedish',
  'synth-pop', 'tango', 'techno', 'trance', 'trip-hop', 'turkish', 'world-music',
]

export const prettyGenre = (g) =>
  g.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
