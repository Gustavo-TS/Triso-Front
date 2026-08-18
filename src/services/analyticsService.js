import { APP_CONFIG } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'
import { localDatabase } from '../lib/localDatabase.js'

const usingApi = APP_CONFIG.dataSource === 'api'

export const analyticsService = {
  async getDashboard(from, to) {
    if (!usingApi) return null
    const query = new URLSearchParams({ from, to })
    return (await apiClient.get(`${APP_CONFIG.endpoints.analyticsDashboard}?${query}`))?.data
  },
  listClicks: () => usingApi ? Promise.resolve([]) : localDatabase.read('clicks'),
  async trackMarketplaceClick(product, listing) {
    const event = { id: crypto.randomUUID(), eventName: 'marketplace_link_clicked', productId: product.id, productName: product.name, marketplace: listing.name, url: listing.url, timestamp: new Date().toISOString() }
    if (usingApi) {
      await apiClient.post(APP_CONFIG.endpoints.marketplaceClicks, { eventId: event.id, linkId: listing.id, source: 'product-page' })
      return event
    }
    const clicks = await localDatabase.read('clicks')
    await localDatabase.write('clicks', [...clicks, event])
    return event
  },
}
