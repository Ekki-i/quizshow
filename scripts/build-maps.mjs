// Erzeugt assets/js/map-data.js: Länderumrisse (Natural Earth, gemeinfrei, über
// das Paket world-atlas) als SVG-Pfade für die drei Kartenansichten.
// Aufruf: npm install --no-save world-atlas@2.0.2 topojson-client@3.1.0 d3-geo@3.1.1
//         node scripts/build-maps.mjs

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { feature } from 'topojson-client';
import { geoProjection, geoPath } from 'd3-geo';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1000;

const VIEWS = {
  Welt: { atlas: 'countries-110m.json', lonMin: -170, lonMax: 190, latMin: -58, latMax: 84, digits: 1 },
  Europa: { atlas: 'countries-50m.json', lonMin: -25, lonMax: 45, latMin: 34, latMax: 71.5, digits: 1 },
  Deutschland: { atlas: 'countries-10m.json', lonMin: 4.5, lonMax: 16.5, latMin: 46.8, latMax: 55.4, digits: 1 },
};

const rad = Math.PI / 180;
const out = {};
for (const [name, v] of Object.entries(VIEWS)) {
  const topo = require(`world-atlas/${v.atlas}`);
  const countries = feature(topo, topo.objects.countries).features;
  // Breitengrad-Stauchung, damit die Karte um die Mitte herum unverzerrt wirkt.
  const c = name === 'Welt' ? 1 : Math.cos(((v.latMin + v.latMax) / 2) * rad);
  const s = WIDTH / ((v.lonMax - v.lonMin) * rad * c);
  const height = Math.round((v.latMax - v.latMin) * rad * s);
  const projection = geoProjection((l, p) => [l * c, p])
    .rotate([-(v.lonMin + v.lonMax) / 2, 0])
    .scale(s)
    .translate([WIDTH / 2, v.latMax * rad * s])
    .clipExtent([[-2, -2], [WIDTH + 2, height + 2]]);
  const pathGen = geoPath(projection).digits(v.digits);
  const paths = countries.map((f) => pathGen(f)).filter(Boolean);
  out[name] = { lonMin: v.lonMin, lonMax: v.lonMax, latMin: v.latMin, latMax: v.latMax, width: WIDTH, height, c, paths };
  console.log(name, paths.length, 'Länder,', Math.round(paths.join('').length / 1024), 'KB');
}

const js = `// Automatisch erzeugt von scripts/build-maps.mjs – nicht von Hand ändern.
// Länderumrisse: Natural Earth (gemeinfrei) über das Paket world-atlas.
export const MAPS = ${JSON.stringify(out)};
`;
fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'map-data.js'), js);
