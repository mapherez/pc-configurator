const STORAGE_KEY = 'i18n_state'

export function loadI18nState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Failed to load i18n state from localStorage:', e)
  }
  return null
}

export function saveI18nState(state: { market: string; settings: { language: string; currency: string } }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save i18n state to localStorage:', e)
  }
}
