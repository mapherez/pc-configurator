#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const APP_ROOT = process.cwd()

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

function formatJsonCompact(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

function formatLocaleWithGrouping(obj) {
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const lines = ['{']
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = obj[k]
    const isLast = i === keys.length - 1
    const next = !isLast ? keys[i + 1] : null

    const kv = `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${isLast ? '' : ','}`
    lines.push(kv)

    if (next) {
      const currInitial = (k[0] || '').toUpperCase()
      const nextInitial = (next[0] || '').toUpperCase()
      if (currInitial !== nextInitial) {
        lines.push('')
      }
    }
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

async function listFiles(dir, predicate = () => true) {
  const abs = path.resolve(APP_ROOT, dir)
  const entries = await fs.readdir(abs, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    if (e.isFile()) {
      const fp = path.join(abs, e.name)
      if (predicate(fp)) files.push(fp)
    }
  }
  return files
}

async function cleanupLocales() {
  const localeDir = 'settings/locale'
  const defaultLocale = path.resolve(APP_ROOT, 'settings/default.locale.json')
  const locales = await listFiles(localeDir, (f) => f.endsWith('.json'))
  const targets = [defaultLocale, ...locales]
  for (const file of targets) {
    try {
      const obj = await readJson(file)
      const out = formatLocaleWithGrouping(obj)
      await fs.writeFile(file, out, 'utf8')
      process.stdout.write(`[cleanup] formatted locale: ${path.relative(APP_ROOT, file)}\n`)
    } catch (err) {
      process.stderr.write(`[cleanup] failed locale ${file}: ${String(err)}\n`)
    }
  }
}

async function cleanupSettings() {
  const marketDir = 'settings/market'
  const defaultSettings = path.resolve(APP_ROOT, 'settings/default.settings.json')
  const settings = await listFiles(marketDir, (f) => f.endsWith('.settings.json'))
  const targets = [defaultSettings, ...settings]
  for (const file of targets) {
    try {
      const obj = await readJson(file)
      const out = formatJsonCompact(obj)
      await fs.writeFile(file, out, 'utf8')
      process.stdout.write(`[cleanup] formatted settings: ${path.relative(APP_ROOT, file)}\n`)
    } catch (err) {
      process.stderr.write(`[cleanup] failed settings ${file}: ${String(err)}\n`)
    }
  }
}

async function main() {
  await cleanupLocales()
  await cleanupSettings()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

