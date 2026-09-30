import { APP_CONFIG } from '../config/app.js'
import { apiClient, ApiError } from '../lib/apiClient.js'

const unwrap = body => body?.data ?? body
const customerOnly = user => user?.permission?.trim().toLocaleLowerCase('pt-BR') === 'cliente' ? user : null

export const accountService = {
  async rawSession() {
    try { return unwrap(await apiClient.get(APP_CONFIG.endpoints.session)) }
    catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error }
  },
  async session() {
    return customerOnly(await accountService.rawSession())
  },
  async loginRaw({ email, password }) { return unwrap(await apiClient.post(APP_CONFIG.endpoints.login, { email, password })) },
  async registerRaw({ name, email, password }) { return unwrap(await apiClient.post(APP_CONFIG.endpoints.register, { name, email, password })) },
  async login({ email, password }) { return customerOnly(await accountService.loginRaw({ email, password })) },
  async register({ name, email, password }) { return customerOnly(await accountService.registerRaw({ name, email, password })) },
  async logout() { await apiClient.post(APP_CONFIG.endpoints.logout, {}) },
  async profile(signal) { return unwrap(await apiClient.get(APP_CONFIG.endpoints.profile, { signal })) },
  async updateProfile({ name, email }) { return unwrap(await apiClient.patch(APP_CONFIG.endpoints.profile, { name: name.trim(), email: email.trim() })) },
}
