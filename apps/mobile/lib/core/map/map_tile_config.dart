/// Shared basemap tile source for every [FlutterMap] in the app. CARTO's
/// Voyager tiles are served off a fast CDN and don't require an API key —
/// unlike OSM's bare tile.openstreetmap.org server, which isn't meant for
/// production traffic and was the cause of slow/laggy map loads.
const kMapTileUrlTemplate = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const kMapUserAgentPackageName = 'app.findfam.mobile';

/// Shared FMTC store name — both maps hit the same CARTO tile source, so
/// they share one on-disk cache instead of downloading the same tile twice.
const kMapCacheStoreName = 'mapTiles';
