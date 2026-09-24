#!/usr/bin/env node
/**
 * Post-build: copy *.module.css from src/ to dist/, preserving
 * directory structure. tsc only emits .ts/.tsx — CSS Modules
 * imports resolve relative to the .js file in dist, so the CSS
 * must live alongside it.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'src')
const distDir = path.join(root, 'dist')

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && entry.name.endsWith('.module.css')) {
      yield full
    }
  }
}

async function copyAll() {
  let count = 0
  for await (const src of walk(srcDir)) {
    const rel = path.relative(srcDir, src)
    const dst = path.join(distDir, rel)
    await fs.mkdir(path.dirname(dst), { recursive: true })
    await fs.copyFile(src, dst)
    count += 1
  }
  console.log(`copy-css: ${count} CSS module files copied to dist/`)
}

await copyAll()
