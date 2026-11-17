// Assemble immutable screenshot inputs into the two required persistent review sheets.
// Run only after the screenshot matrix; this command verifies assembly, not product behavior.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { REVIEW_BATCHES } from './shots-spec-scenes.ts';

const value = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = resolve(value('input') ?? '../tmp/screens');
const date = value('date');
const batch = value('batch');
if (!date || !/^\d{8}$/.test(date)) throw new Error('explicit yyyymmdd review date required');
if (batch && !Object.hasOwn(REVIEW_BATCHES, batch)) throw new Error('unknown review batch');
const output = '/home/coder/workspace/lkjstr-review';
const selections = [
  { tag: '1440-dark-ja', width: 1440, height: 900, label: '1440 dark ja' },
  { tag: '390-light-ja', width: 390, height: 844, label: '390 light ja' },
] as const;
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const selected = Object.entries(REVIEW_BATCHES).filter(([key]) => !batch || key === batch);
const jobs = selected.map(([name, scenes]) => {
  const destination = join(output, `${name}-${date}.jpg`);
  if (existsSync(destination) || existsSync(destination.replace(/\.jpg$/, '.json')))
    throw new Error('review output already exists; preserve it and choose another owned attempt');
  const images = scenes.flatMap((scene) =>
    selections.map((selection) => {
      const path = join(input, `${scene}-${selection.tag}.png`);
      if (statSync(path).size > 8 * 1024 * 1024) throw new Error('screenshot exceeds input bound');
      const bytes = readFileSync(path);
      if (
        bytes.length > 8 * 1024 * 1024 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new Error('invalid or oversized screenshot input');
      return {
        ...selection,
        scene,
        path,
        bytes: bytes.length,
        sha256: hash(bytes),
        data: `data:image/png;base64,${bytes.toString('base64')}`,
      };
    }),
  );
  if (images.length > 128 || images.reduce((n, image) => n + image.bytes, 0) > 128 * 1024 * 1024)
    throw new Error('review batch exceeds image bound');
  return { name, scenes, images, destination };
});
if (!process.env.TMPDIR) throw new Error('explicit short owned TMPDIR required');
mkdirSync(process.env.TMPDIR, { recursive: true });
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.LKJSTR_CHROME ??
    `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ['--no-sandbox'],
  timeout: 30000,
});
try {
  for (const job of jobs) {
    const page = await browser.newPage();
    try {
      await page.route('**/*', (route) => route.abort());
      const result = await page.evaluate(
        async ({ images, sceneCount }) => {
          const limit = 2000,
            margin = 16,
            gap = 12,
            inside = 10,
            caption = 32;
          const ratio = 1440 / 900 + 390 / 844;
          let chosen = { columns: 1, height: 0 };
          for (let columns = 1; columns <= sceneCount; columns++) {
            const rows = Math.ceil(sceneCount / columns);
            const height = Math.floor(
              Math.min(
                (limit - 2 * margin - (columns - 1) * gap - columns * inside) / (columns * ratio),
                (limit - 2 * margin - (rows - 1) * gap) / rows - caption,
              ),
            );
            if (height > chosen.height) chosen = { columns, height };
          }
          const desktop = Math.floor((chosen.height * 1440) / 900);
          const phone = Math.floor((chosen.height * 390) / 844);
          const block = desktop + inside + phone;
          const rows = Math.ceil(sceneCount / chosen.columns);
          const canvas = document.createElement('canvas');
          canvas.width = 2 * margin + chosen.columns * block + (chosen.columns - 1) * gap;
          canvas.height = 2 * margin + rows * (chosen.height + caption) + (rows - 1) * gap;
          if (canvas.width > limit || canvas.height > limit || chosen.height <= 0)
            throw new Error('review dimensions exceed specification');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('review canvas unavailable');
          context.fillStyle = '#eee';
          context.fillRect(0, 0, canvas.width, canvas.height);
          for (let index = 0; index < images.length; index++) {
            const source = images[index]!;
            const image = new Image();
            image.src = source.data;
            await image.decode();
            if (image.naturalWidth !== source.width || image.naturalHeight !== source.height)
              throw new Error('screenshot dimensions do not match the named capture');
            const scene = Math.floor(index / 2);
            const x = margin + (scene % chosen.columns) * (block + gap);
            const y = margin + Math.floor(scene / chosen.columns) * (chosen.height + caption + gap);
            context.fillStyle = '#222';
            context.font = '14px sans-serif';
            if (index % 2 === 0) context.fillText(source.scene, x, y + 13);
            const offset = index % 2 === 0 ? 0 : desktop + inside;
            context.font = '11px sans-serif';
            context.fillText(source.label, x + offset, y + 27);
            context.drawImage(
              image,
              x + offset,
              y + caption,
              index % 2 === 0 ? desktop : phone,
              chosen.height,
            );
          }
          return {
            width: canvas.width,
            height: canvas.height,
            data: canvas.toDataURL('image/jpeg', 0.82).split(',')[1]!,
          };
        },
        { images: job.images, sceneCount: job.scenes.length },
      );
      const bytes = Buffer.from(result.data, 'base64');
      writeFileSync(job.destination, bytes, { flag: 'wx' });
      writeFileSync(
        job.destination.replace(/\.jpg$/, '.json'),
        JSON.stringify(
          {
            batch: job.name,
            assembledAt: new Date().toISOString(),
            width: result.width,
            height: result.height,
            sha256: hash(bytes),
            bytes: bytes.length,
            scenes: job.scenes,
            language: 'ja',
            images: job.images.map(({ data: _data, ...image }) => image),
            scope: 'Screenshot assembly only; capture provenance remains with the source matrix.',
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
      console.log(
        `ok review ${basename(job.destination)} ${result.width}x${result.height} ${hash(bytes)}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
