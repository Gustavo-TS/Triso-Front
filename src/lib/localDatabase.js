import { APP_CONFIG } from '../config/app.js'
import { MOCK_DATABASE } from '../mocks/database.js'

const clone = value => structuredClone(value)

export const localDatabase = {
  read(collection) {
    const key = APP_CONFIG.storage[collection]
    const fallback = collection === 'clicks' ? MOCK_DATABASE.marketplaceClicks : MOCK_DATABASE[collection]
    try {
      const stored = localStorage.getItem(key)
      return Promise.resolve(stored ? JSON.parse(stored) : clone(fallback))
    } catch {
      return Promise.resolve(clone(fallback))
    }
  },
  write(collection, value) {
    localStorage.setItem(APP_CONFIG.storage[collection], JSON.stringify(value))
    return Promise.resolve(clone(value))
  },
  getSession() {
    try { return Promise.resolve(JSON.parse(sessionStorage.getItem(APP_CONFIG.storage.session))) }
    catch { return Promise.resolve(null) }
  },
  setSession(session) {
    sessionStorage.setItem(APP_CONFIG.storage.session, JSON.stringify(session))
    return Promise.resolve(session)
  },
  clearSession() {
    sessionStorage.removeItem(APP_CONFIG.storage.session)
    return Promise.resolve()
  },
}
