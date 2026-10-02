import { apiClient } from '../lib/apiClient.js'

const unwrap = body => body?.data ?? body

export const shippingService = {
  quote(postalCode, items, signal) {
    return apiClient.post('/api/v1/shipping/quotes', { postalCode: String(postalCode).replace(/\D/g, ''), items: items.map(({ productId, quantity }) => ({ productId, quantity })) }, { signal }).then(unwrap)
  },
}
