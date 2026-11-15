// Cloudflare Worker: CORS proxy for the McKinney flight map.
// Only answers /v2/point/{lat}/{lon}/{nm}, and only for requests sent by the GitHub Pages site.
// The Origin check stops other sites and casual curl use. A script can fake the header,
// so add a Cloudflare rate limiting rule if the Worker ever gets hammered.
const ALLOWED = ['https://raynull1974.github.io'];
const FEED_TIMEOUT_MS = 3000; // time to first response per feed; three must fit inside the page's 12 s proxy timeout
const FEEDS = [
  ['adsb.lol', (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`],
  ['adsb.fi', (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`],
  ['airplanes.live', (la, lo, r) => `https://api.airplanes.live/v2/point/${la}/${lo}/${r}`]
];

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin');
    const ok = !!origin && ALLOWED.includes(origin);
    const headers = {
      'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0], 'Access-Control-Expose-Headers': 'X-Feed',
      'Vary': 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'max-age=5'
    };
    if (!ok) return new Response('{"error":"origin not allowed"}', { status: 403, headers });

    const m = new URL(req.url).pathname.match(/^\/v2\/point\/(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)\/(\d{1,3})$/);
    if (!m || +m[3] > 250) return new Response('{"error":"not found"}', { status: 404, headers });

    // Each feed gets a short wait for its first response. The timer is cleared once headers arrive,
    // so a big response (100 nm around DFW) can finish streaming.
    const tried = [];
    for (const [name, url] of FEEDS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), FEED_TIMEOUT_MS);
      const t0 = Date.now();
      try {
        const r = await fetch(url(m[1], m[2], m[3]), {
          headers: { 'User-Agent': 'mckinney-flights (github.com/raynull1974/mckinney-flights)', 'Accept': 'application/json' },
          // Share good answers between viewers for 5 s; never cache a refusal (a cached 429 would stick).
          cf: { cacheTtlByStatus: { '200-299': 5, '300-599': 0 }, cacheEverything: true },
          signal: ctl.signal
        });
        clearTimeout(timer);
        if (r.ok) {
          if (tried.length) console.log(JSON.stringify({ served: name, failed: tried }));
          return new Response(r.body, { status: 200, headers: { ...headers, 'X-Feed': name } });
        }
        tried.push(`${name} ${r.status}`);
        if (r.body) r.body.cancel();
      } catch (e) {
        clearTimeout(timer);
        tried.push(`${name} ${ctl.signal.aborted ? 'timeout' : 'error'} ${Date.now() - t0}ms`);
      }
    }
    // Shows in Workers Logs (dashboard > Worker > Logs) and goes back to the page so it can say why.
    console.log(JSON.stringify({ allFailed: tried }));
    return new Response(JSON.stringify({ error: 'all feeds failed', tried }), { status: 502, headers });
  }
};
