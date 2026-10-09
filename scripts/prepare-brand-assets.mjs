import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const original = publicDir + 'brand/gsl-systems-original.png';
// The supplied artwork stays intact. Only surrounding whitespace and export
// dimensions change; no generated reconstruction or color filter is used.
const logoBounds = {left:110, top:384, width:1034, height:504};
const symbolBounds = {left:110, top:384, width:1034, height:318};
const paper = '#fffefa';
const png = {palette:true, colours:256, dither:0, compressionLevel:9};
const logo = await sharp(original).extract(logoBounds).resize(620).png(png).toBuffer();
const symbol = await sharp(original).extract(symbolBounds).png(png).toBuffer();
await writeFile(publicDir + 'brand/gsl-systems-logo.png', logo);

async function square(input, size, padding) {
  const artwork = await sharp(input).resize(size - padding * 2, size - padding * 2, {fit:'inside'}).toBuffer();
  return sharp({create:{width:size, height:size, channels:3, background:paper}})
    .composite([{input:artwork, gravity:'centre'}]).png(png).toBuffer();
}
const icon = await square(symbol, 256, 10);
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><title>GSL systems</title><image width="256" height="256" href="data:image/png;base64,${icon.toString('base64')}"/></svg>\n`;
await writeFile(publicDir + 'favicon.svg', iconSvg);
await writeFile(publicDir + 'favicon-32.png', await square(symbol, 32, 1));
await writeFile(publicDir + 'apple-touch-icon.png', await square(logo, 180, 12));

// ICO supports PNG entries. Keep common sizes for legacy browser requests.
const sizes = [16, 32, 48, 256];
const entries = await Promise.all(sizes.map(size => square(symbol, size, size < 48 ? 0 : 2)));
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((entry, i) => {
  const start = 6 + i * 16;
  header[start] = sizes[i] === 256 ? 0 : sizes[i];
  header[start + 1] = header[start];
  header.writeUInt16LE(1, start + 4);
  header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(entry.length, start + 8);
  header.writeUInt32LE(offset, start + 12);
  offset += entry.length;
});
await writeFile(publicDir + 'favicon.ico', Buffer.concat([header, ...entries]));

const shareLogo = await sharp(logo).resize(880).toBuffer();
await sharp({create:{width:1200, height:630, channels:3, background:paper}})
  .composite([{input:shareLogo, gravity:'centre'}]).png(png)
  .toFile(publicDir + 'brand/gsl-systems-social.png');

// Preserve existing image URLs (bookmarks or old emails) with the new artwork.
const legacySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1034" height="504" viewBox="0 0 1034 504"><title>GSL systems</title><image width="1034" height="504" href="data:image/png;base64,${logo.toString('base64')}"/></svg>\n`;
for (const name of ['is-systems.svg', 'is-systems-white.svg']) {
  await writeFile(publicDir + 'brand/' + name, legacySvg);
}
console.log('Brand exports ready: logo, browser icons, Apple icon, social image and legacy URLs.');
