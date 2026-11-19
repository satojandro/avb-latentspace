import { readFileSync, writeFileSync } from 'fs';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';
const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json'));
const land = feature(topo, topo.objects.land);
const STEP = 1.6, LAT0 = 82, LAT1 = -58;
const cols = Math.round(360/STEP), rows = Math.round((LAT0-LAT1)/STEP);
const bits = new Uint8Array(Math.ceil(cols*rows/8)); let n=0;
for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
  const lon=-180+STEP*(c+.5), lat=LAT0-STEP*(r+.5);
  if (geoContains(land,[lon,lat])) { const i=r*cols+c; bits[i>>3]|=1<<(i&7); n++; }
}
writeFileSync('dots.json', JSON.stringify({cols,rows,STEP,LAT0,b64:Buffer.from(bits).toString('base64')}));
console.log(cols,rows,n, Buffer.from(bits).toString('base64').length);
