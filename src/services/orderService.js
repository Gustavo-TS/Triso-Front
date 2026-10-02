import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'

const unwrap = body => body?.data ?? body

export const orderService = {
  create: (items, address, shippingQuoteId) => apiClient.post(APP_CONFIG.endpoints.orders, { items, address, shippingQuoteId }).then(unwrap),
  checkout: id => apiClient.post(`${APP_CONFIG.endpoints.orders}/${id}/checkout`, {}).then(unwrap),
  list: signal => apiClient.get(APP_CONFIG.endpoints.accountOrders, { signal }).then(unwrap),
  get: (id, signal) => apiClient.get(`${APP_CONFIG.endpoints.accountOrders}/${id}`, { signal }).then(unwrap),
  adminList: ({ status, page = 1, pageSize = 50, sort = 'shippingDeadline' } = {}) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort })
    if (status !== undefined && status !== '') query.set('status', String(status))
    return apiClient.get(`${APP_CONFIG.endpoints.adminOrders}?${query}`).then(unwrap)
  },
  adminGet: id => apiClient.get(`${APP_CONFIG.endpoints.adminOrders}/${id}`).then(unwrap),
  adminSetStatus: (id, status) => apiClient.patch(`${APP_CONFIG.endpoints.adminOrders}/${id}/status`, { status }).then(unwrap),
  adminSetTracking: (id, trackingCode) => apiClient.patch(`${APP_CONFIG.endpoints.adminOrders}/${id}/shipping`, { trackingCode }).then(unwrap),
  adminDashboard: (from, to, region = '') => {
    const query = new URLSearchParams({ from, to })
    if (region) query.set('region', region)
    return apiClient.get(`${APP_CONFIG.endpoints.adminDashboard}?${query}`).then(unwrap)
  },
}
