// Small wrapper around localStorage. Everything stays in the user's browser.
const PREFIX = 'clipcraft:'

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage full or blocked: the app still works for this session
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}
