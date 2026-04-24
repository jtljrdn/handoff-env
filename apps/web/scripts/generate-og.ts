import { Resvg } from '@resvg/resvg-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WIDTH = 1200
const HEIGHT = 630

// Dark palette mirrors src/styles.css .dark --h-bg, --h-text, --h-accent.
const BG = '#1a1612'
const TEXT = '#e7e2d8'
const TEXT_MUTED = '#8f8779'
const ACCENT = '#d59a4a'
const ACCENT_DIM = '#b07c30'

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glowA" cx="18%" cy="-5%" r="55%" fx="18%" fy="-5%">
      <stop offset="0%" stop-color="#3a2d1c" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#3a2d1c" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="88%" cy="0%" r="48%" fx="88%" fy="0%">
      <stop offset="0%" stop-color="#3a2718" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#3a2718" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowC" cx="92%" cy="105%" r="55%" fx="92%" fy="105%">
      <stop offset="0%" stop-color="#d59a4a" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#d59a4a" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e7e2d8" stroke-opacity="0.04" stroke-width="1" />
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowA)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowB)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowC)" />

  <g transform="translate(96, 108)">
    <g transform="scale(6)">
      <rect x="0" y="3" width="11" height="13" rx="2.5" fill="${ACCENT}" fill-opacity="0.45" />
      <rect x="5" y="5" width="11" height="13" rx="2.5" fill="${ACCENT}" />
    </g>
    <text x="144" y="86" font-family="'Schibsted Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="88" font-weight="800" fill="${TEXT}" letter-spacing="-3">Handoff</text>
  </g>

  <g transform="translate(96, 332)">
    <text font-family="'Schibsted Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="${TEXT}" letter-spacing="-2.5">
      <tspan x="0" dy="0">Your </tspan>
      <tspan font-family="'JetBrains Mono', 'Menlo', 'Consolas', monospace" font-size="72" fill="${ACCENT}">.env</tspan>
      <tspan> file,</tspan>
      <tspan x="0" dy="100">but shared.</tspan>
    </text>
  </g>

  <g transform="translate(96, 566)">
    <circle cx="6" cy="-6" r="6" fill="${ACCENT}" />
    <text x="22" y="0" font-family="'Figtree', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="${TEXT_MUTED}" letter-spacing="4">ENVIRONMENT VARIABLES FOR TEAMS</text>
  </g>

  <text x="${WIDTH - 96}" y="${HEIGHT - 64}" text-anchor="end" font-family="'JetBrains Mono', 'Menlo', 'Consolas', monospace" font-size="22" font-weight="500" fill="${ACCENT_DIM}">gethandoff.dev</text>
</svg>`

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '..', 'public', 'og-image.png')

await mkdir(dirname(outPath), { recursive: true })

const resvg = new Resvg(svg, {
  background: BG,
  fitTo: { mode: 'width', value: WIDTH },
  font: {
    loadSystemFonts: true,
    defaultFontFamily: 'Helvetica',
  },
})

const png = resvg.render().asPng()
await writeFile(outPath, png)

console.log(`wrote ${outPath} (${png.byteLength} bytes)`)
