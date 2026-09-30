import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'

const unwrap = body => body?.data ?? body

export const orderService = {
  create: (items, address, shippingQuoteId) => apiClient.post(APP_CONFIG.endpoints.orders, { items, address, shippingQuoteId }).then(unwrap),
  checkout: id => apiClient.post(`${APP_CONFIG.endpoints.orders}/${id}/checkout`, {}).then(unwrap),
  list: signal => apiClient.get(APP_CONFIG.endpoints.accountOrders, { signal }).then(unwrap),
  get: (id, signal) => apiClient.get(`${APP_CONFIG.endpoints.accountOrders}/${id}`, { signal }).then(unwrap),
}
