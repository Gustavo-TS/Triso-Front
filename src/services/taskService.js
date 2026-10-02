import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'

const unwrap = body => body?.data ?? body
const base = APP_CONFIG.endpoints.adminTasks

export const taskService = {
  list: (from, to, assignedToUserId = '') => {
    const query = new URLSearchParams({ from, to })
    if (assignedToUserId) query.set('assignedToUserId', assignedToUserId)
    return apiClient.get(`${base}?${query}`).then(unwrap)
  },
  get: id => apiClient.get(`${base}/${id}`).then(unwrap),
  eligibleOrders: () => apiClient.get(`${base}/eligible-orders`).then(unwrap),
  create: payload => apiClient.post(base, payload).then(unwrap),
  update: (id, payload) => apiClient.put(`${base}/${id}`, payload).then(unwrap),
  setCompletion: (id, isCompleted) => apiClient.patch(`${base}/${id}/completion`, { isCompleted }).then(unwrap),
  setOrderCompletion: (taskId, orderId, isCompleted) => apiClient.patch(`${base}/${taskId}/orders/${orderId}/completion`, { isCompleted }).then(unwrap),
  remove: id => apiClient.delete(`${base}/${id}`),
}
