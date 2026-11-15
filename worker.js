// Cloudflare Worker: CORS proxy for the adsb.lol point endpoint only.
// Deploy free at dash.cloudflare.com > Workers & Pages > Create > Hello World, paste this, Deploy.
export default {
  async fetch(req) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'max-age=5' };
    const path = new URL(req.url).pathname;
    if (!/^\/v2\/point\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/\d{1,3}$/.test(path)) {
      return new Response('{"error":"not found"}', { status: 404, headers: cors });
    }
    const r = await fetch('https://api.adsb.lol' + path, {
      headers: { 'User-Agent': 'mckinney-flights (github.com/raynull1974/mckinney-flights)' },
      cf: { cacheTtl: 5, cacheEverything: true }
    });
    return new Response(r.body, { status: r.status, headers: cors });
  }
};
