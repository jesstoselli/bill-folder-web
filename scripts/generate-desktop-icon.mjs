import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// The 1024px source for `tauri icon`: the brand symbol on the macOS icon
// grid (an 824px rounded square centred on the canvas).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const symbol = await readFile(resolve(root, 'public/brand/billfolder-symbol.svg'), 'utf8');
const symbolBody = symbol.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#1E1E1E" />
  <!-- Slightly larger and optically centered inside the macOS icon tile. -->
  <g transform="translate(106 96) scale(4)">${symbolBody}</g>
</svg>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`,
  );
  const png = await page.locator('svg').screenshot({ omitBackground: true });
  await writeFile(resolve(root, 'src-tauri/app-icon.png'), png);
} finally {
  await browser.close();
}
