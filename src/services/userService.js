import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'

const unwrap = body => body?.data || body

export const userService = {
  async listPermissions() {
    const permissions = unwrap(await apiClient.get(APP_CONFIG.endpoints.adminPermissions))
    return Array.isArray(permissions) ? permissions : []
  },
  async list() {
    const users = unwrap(await apiClient.get(APP_CONFIG.endpoints.adminUsers))
    return Array.isArray(users) ? users : []
  },
  async create(user) {
    const payload = {
      name: user.name,
      email: user.email,
      password: user.password,
      idPermission: Number(user.idPermission),
      active: user.active !== false,
    }
    return unwrap(await apiClient.post(APP_CONFIG.endpoints.adminUsers, payload))
  },
  async update(id, changes) {
    const payload = { ...changes }
    if ('idPermission' in payload) payload.idPermission = Number(payload.idPermission)
    if ('active' in payload) payload.active = payload.active === true
    await apiClient.patch(`${APP_CONFIG.endpoints.adminUsers}/${id}`, payload)
  },
  async block(id) {
    await apiClient.delete(`${APP_CONFIG.endpoints.adminUsers}/${id}`)
  },
}
