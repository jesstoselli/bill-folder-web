import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public/brand/billfolder-symbol.svg');
const iconDirectory = resolve(root, 'public/icons');
const manifestSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const faviconSizes = [16, 32, 48];

await mkdir(iconDirectory, { recursive: true });

const svg = await readFile(source, 'utf8');
const browser = await chromium.launch({ headless: true });

try {
  for (const size of manifestSizes) {
    const png = await renderPng(size);
    await writeFile(resolve(iconDirectory, `icon-${size}x${size}.png`), png);
  }

  const faviconImages = await Promise.all(faviconSizes.map(renderPng));
  await writeFile(resolve(root, 'public/favicon.ico'), createIco(faviconImages, faviconSizes));
} finally {
  await browser.close();
}

async function renderPng(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });

  try {
    await page.setContent(`
      <style>
        html, body { background: transparent; height: 100%; margin: 0; width: 100%; }
        svg { display: block; height: 100%; width: 100%; }
      </style>
      ${svg}
    `);
    return await page.screenshot({ omitBackground: true, type: 'png' });
  } finally {
    await page.close();
  }
}

function createIco(images, sizes) {
  const headerSize = 6;
  const entrySize = 16;
  const dataStart = headerSize + entrySize * images.length;
  const header = Buffer.alloc(dataStart);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = dataStart;
  images.forEach((image, index) => {
    const entryOffset = headerSize + entrySize * index;
    const size = sizes[index];
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += image.length;
  });

  return Buffer.concat([header, ...images]);
}
