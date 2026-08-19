import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'
import { localDatabase } from '../lib/localDatabase.js'
import { MOCK_DATABASE } from '../mocks/database.js'

const usingApi = APP_CONFIG.dataSource === 'api'
const panelPermissions = new Set(['admin', 'gestor', 'dashboard'])
const hasPanelAccess = user => user?.active !== false && panelPermissions.has(user?.permission?.trim().toLocaleLowerCase('pt-BR'))

const requirePanelSession = user => {
  if (!hasPanelAccess(user)) throw new Error('Esta conta não possui acesso ao painel.')
  return user
}

export const authService = {
  getSession: async () => {
    if (!usingApi) {
      const user = await localDatabase.getSession()
      return hasPanelAccess(user) ? user : null
    }
    try {
      const user = (await apiClient.get(APP_CONFIG.endpoints.session))?.data || null
      return hasPanelAccess(user) ? user : null
    }
    catch (error) { if (error.status === 401) return null; throw error }
  },
  async login(credentials) {
    if (usingApi) return requirePanelSession((await apiClient.post(APP_CONFIG.endpoints.login, credentials))?.data)
    const user = MOCK_DATABASE.users.find(item => item.email === credentials.email && item.password === credentials.password)
    if (!user || !user.active) throw new Error('E-mail ou senha incorretos.')
    const session = requirePanelSession(({ id: user.id, name: user.name, email: user.email, idPermission: user.idPermission, permission: user.permission, active: user.active }))
    return localDatabase.setSession(session)
  },
  async logout() {
    if (usingApi) await apiClient.post(APP_CONFIG.endpoints.logout, {})
    await localDatabase.clearSession()
  },
}
