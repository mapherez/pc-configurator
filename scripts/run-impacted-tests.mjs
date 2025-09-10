#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim()
}

function hasServerTests() {
  try {
    const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'))
    return (
      Boolean(pkg.scripts?.['test']) ||
      Boolean(pkg.scripts?.['test:run']) ||
      Boolean(pkg.scripts?.['test:related'])
    )
  } catch {
    return false
  }
}

function main() {
  let staged = ''
  try {
    staged = sh('git diff --name-only --cached')
  } catch {
    console.log('[tests] No staged files detected; skipping impacted tests')
    process.exit(0)
  }
  const files = staged.split('\n').filter(Boolean)
  const codeFiles = files.filter(
    (f) => /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('node_modules/') && !f.includes('dist/')
  )

  const feFiles = codeFiles.filter((f) => f.startsWith('apps/frontend/'))
  const seFiles = codeFiles.filter((f) => f.startsWith('apps/server/'))

  // Frontend impacted tests
  if (feFiles.length > 0) {
    const args = feFiles.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(' ')
    console.log(`[tests] Running frontend impacted tests for ${feFiles.length} file(s) ...`)
    execSync(`npm run -w apps/frontend test:related -- ${args}`, { stdio: 'inherit' })
  } else {
    console.log('[tests] No frontend code changes; skipping frontend tests')
  }

  // Server tests (if configured)
  if (hasServerTests()) {
    if (seFiles.length > 0) {
      try {
        const args = seFiles.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(' ')
        console.log(`[tests] Running server impacted tests for ${seFiles.length} file(s) ...`)
        execSync(`npm run -w apps/server test:related -- ${args}`, { stdio: 'inherit' })
      } catch {
        // fallback to full server tests if related isn't configured
        console.log('[tests] Falling back to full server tests ...')
        execSync('npm run -w apps/server test:run', { stdio: 'inherit' })
      }
    } else {
      console.log('[tests] No server code changes; skipping server tests')
    }
  } else {
    console.log('[tests] Server tests not configured; skipping')
  }
}

main()

