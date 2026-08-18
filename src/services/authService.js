import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'
import { localDatabase } from '../lib/localDatabase.js'
import { MOCK_DATABASE } from '../mocks/database.js'

const usingApi = APP_CONFIG.dataSource === 'api'

export const authService = {
  getSession: async () => {
    if (!usingApi) return localDatabase.getSession()
    try { return (await apiClient.get(APP_CONFIG.endpoints.session))?.data || null }
    catch (error) { if (error.status === 401) return null; throw error }
  },
  async login(credentials) {
    if (usingApi) return (await apiClient.post(APP_CONFIG.endpoints.login, credentials))?.data
    const user = MOCK_DATABASE.users.find(item => item.email === credentials.email && item.password === credentials.password)
    if (!user) throw new Error('E-mail ou senha incorretos.')
    const session = { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken: 'mock-session-token' }
    await localDatabase.setSession(session)
    return session
  },
  async logout() {
    if (usingApi) await apiClient.post(APP_CONFIG.endpoints.logout, {})
    await localDatabase.clearSession()
  },
}
