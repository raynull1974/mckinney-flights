# mckinney-flights
Live map of flights near McKinney, TX. Data from [adsb.fi](https://adsb.fi) and [adsb.lol](https://adsb.lol) (ODbL), map tiles © OpenStreetMap contributors, map library [Leaflet](https://leafletjs.com) 1.9.4 (BSD-2-Clause).

Open: https://raynull1974.github.io/mckinney-flights/

## How it's deployed
- `index.html` is the whole site. GitHub Pages serves it from `main`.
- `worker.js` is a Cloudflare Worker (`mckinney-flights-proxy`) that proxies the flight feeds. Cloudflare Workers Builds redeploys it on every push to `main`, using `wrangler.jsonc`.
- The page calls the Worker first (`PROXY` in `index.html`) and falls back to the public feeds directly. It goes back to the Worker within a minute of a failure.
- The Worker only answers requests whose `Origin` is the GitHub Pages site. To serve the page from another domain, add it to `ALLOWED` in `worker.js`.

## Location
- Default view is McKinney.
- **Near me** uses the browser's location (rounded to about 1 km before it's sent to the flight feeds). The choice is remembered on that device.
- Share a fixed spot with a link: `?lat=32.78&lon=-96.80&name=Downtown%20Dallas`
- Place names come from OpenStreetMap Nominatim.
