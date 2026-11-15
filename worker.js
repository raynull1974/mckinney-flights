// Cloudflare Worker: CORS proxy for the McKinney flight map.
// Only answers /v2/point/{lat}/{lon}/{nm}, and only for requests sent by the GitHub Pages site.
// The Origin check stops other sites and casual curl use. A script can fake the header,
// so add a Cloudflare rate limiting rule if the Worker ever gets hammered.
const ALLOWED = ['https://raynull1974.github.io'];
const FEED_TIMEOUT_MS = 3500; // time to first response per feed; two must fit inside the page's 8 s timeout
const FEEDS = [
  (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`,
  (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`
];

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin');
    const ok = !!origin && ALLOWED.includes(origin);
    const headers = { 'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0], 'Vary': 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'max-age=5' };
    if (!ok) return new Response('{"error":"origin not allowed"}', { status: 403, headers });

    const m = new URL(req.url).pathname.match(/^\/v2\/point\/(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)\/(\d{1,3})$/);
    if (!m || +m[3] > 250) return new Response('{"error":"not found"}', { status: 404, headers });

    for (const feed of FEEDS) {
      // The timer only covers waiting for the feed to answer. Once headers arrive it's cleared,
      // so a big response (100 nm around DFW) can finish streaming. AbortSignal.timeout would
      // cut the body off mid-download.
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), FEED_TIMEOUT_MS);
      try {
        const r = await fetch(feed(m[1], m[2], m[3]), {
          headers: { 'User-Agent': 'mckinney-flights (github.com/raynull1974/mckinney-flights)' },
          cf: { cacheTtl: 5, cacheEverything: true },
          signal: ctl.signal
        });
        clearTimeout(timer);
        if (r.ok) return new Response(r.body, { status: 200, headers });
      } catch (e) { clearTimeout(timer); /* timed out or failed: try the next feed */ }
    }
    return new Response('{"error":"all feeds failed"}', { status: 502, headers });
  }
};
