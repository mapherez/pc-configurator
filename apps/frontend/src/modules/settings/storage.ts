import type { StoredState } from './types'

const STORAGE_KEY = 'pc-configurator:settings'

export function loadStoredState(): StoredState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return null
    return JSON.parse(json)
  } catch {
    console.warn('Failed to load settings from localStorage')
    return null
  }
}

export function saveStoredState(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save settings to localStorage:', e)
  }
}
