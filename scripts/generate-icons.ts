import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const staticDir = new URL('../static/', import.meta.url);
const svgPath = new URL('icon.svg', staticDir);
const outputs = [
  { path: 'icon-32.png', size: 32 },
  { path: 'icon-48.png', size: 48 },
  { path: 'icon-192.png', size: 192 },
  { path: 'icon-512.png', size: 512 },
  { path: 'apple-touch-icon.png', size: 180 },
];

await mkdir(staticDir, { recursive: true });
const svg = await readFile(svgPath, 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const pngs = await Promise.all(
  outputs.map(async (output) => ({
    ...output,
    png: await renderPng(page, svg, output.size),
  })),
);

await browser.close();

for (const output of pngs) {
  await writeFile(new URL(output.path, staticDir), output.png);
}

await writeFile(
  new URL('favicon.ico', staticDir),
  icoFromPngs(pngs.filter((item) => [32, 48, 192].includes(item.size))),
);

async function renderPng(
  page: Awaited<ReturnType<typeof browser.newPage>>,
  source: string,
  size: number,
): Promise<Buffer> {
  const base64 = Buffer.from(source).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  const bytes = await page.evaluate(
    async ({ dataUrl, size }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas context unavailable');
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      const array = await new Promise<number[]>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('png blob unavailable'));
          resolve([...new Uint8Array(await blob.arrayBuffer())]);
        }, 'image/png');
      });
      return array;
    },
    { dataUrl, size },
  );
  return Buffer.from(bytes);
}

function icoFromPngs(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  const chunks = [header];
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(image.size === 256 ? 0 : image.size, entry);
    header.writeUInt8(image.size === 256 ? 0 : image.size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.png.length;
    chunks.push(image.png);
  });
  return Buffer.concat(chunks);
}
