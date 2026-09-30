import { apiClient } from '../lib/apiClient.js'

const PATH = '/api/v1/admin/shipping/settings'
const unwrap = body => body?.data ?? body

export const shippingSettingsService = {
  get: signal => apiClient.get(PATH, { signal }).then(unwrap),
  save: settings => apiClient.put(PATH, settings).then(unwrap),
}
