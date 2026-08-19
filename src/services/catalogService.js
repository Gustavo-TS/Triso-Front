import { APP_CONFIG, CATALOG_OPTIONS } from '../config/app.js'
import { apiClient } from '../lib/apiClient.js'
import { localDatabase } from '../lib/localDatabase.js'

const usingApi = APP_CONFIG.dataSource === 'api'
const normalize = product => {
  if (!usingApi) {
    const marketplaces = product.marketplaces?.length ? product.marketplaces : product.marketplaceUrl ? [{ name: product.marketplace || 'Marketplace', url: product.marketplaceUrl }] : []
    return { ...product, marketplaces, marketplace: marketplaces[0]?.name || '', marketplaceUrl: marketplaces[0]?.url || '' }
  }
  const marketplaces = (product.marketplaceLinks || []).map(link => ({
    id: link.id,
    marketplaceId: link.marketplace?.marketplaceId || link.marketplaceId,
    name: link.marketplace?.name || 'Marketplace',
    slug: link.marketplace?.slug || '',
    url: link.url,
    externalProductId: link.externalProductId || '',
  }))
  const cover = product.images?.[0]
  return {
    ...product,
    categoryId: product.category?.categoryId || product.categoryId,
    category: product.category?.slug || '',
    categoryName: product.category?.name || 'Outros',
    price: Number(product.priceCents || 0) / 100,
    imageUrl: cover?.url || '',
    marketplaces,
    marketplace: marketplaces[0]?.name || '',
    marketplaceUrl: marketplaces[0]?.url || '',
    active: product.status === 'published',
  }
}

const unwrapList = body => Array.isArray(body) ? body : body?.data || []

const toApiPayload = product => ({
  name: product.name.trim(),
  description: product.description?.trim() || '',
  priceCents: Math.round(Number(product.price) * 100),
  badge: product.badge?.trim() || null,
  status: product.status || (product.active ? 'published' : 'draft'),
  categoryId: product.categoryId,
  images: product.images?.length
    ? product.images.filter(image => image.url).map((image, index) => ({ url: image.url, altText: image.altText || product.name.trim(), displayOrder: index, isCover: index === 0 }))
    : product.imageUrl ? [{ url: product.imageUrl, altText: product.name.trim(), displayOrder: 0, isCover: true }] : [],
  marketplaceLinks: (product.marketplaces || []).map(listing => ({
    marketplaceId: listing.marketplaceId,
    url: listing.url,
    externalProductId: listing.externalProductId?.trim() || null,
  })),
})

export const catalogService = {
  async list({ admin = false } = {}) {
    const products = usingApi
      ? unwrapList(await apiClient.get(admin ? APP_CONFIG.endpoints.adminProducts : `${APP_CONFIG.endpoints.catalogProducts}?limit=50`))
      : await localDatabase.read('products')
    return products.map(normalize)
  },
  async save(product) {
    if (usingApi) {
      const path = product.id ? `${APP_CONFIG.endpoints.adminProducts}/${product.id}` : APP_CONFIG.endpoints.adminProducts
      return product.id ? apiClient.patch(path, toApiPayload(product)) : apiClient.post(path, toApiPayload(product))
    }
    const products = await localDatabase.read('products')
    const saved = product.id ? product : { ...product, id: Date.now() }
    const next = product.id ? products.map(item => item.id === product.id ? saved : item) : [saved, ...products]
    await localDatabase.write('products', next)
    return normalize(saved)
  },
  async setActive(id, active) {
    if (usingApi) throw new Error('Para alterar o status, envie o produto completo.')
    const products = await localDatabase.read('products')
    const next = products.map(item => item.id === id ? { ...item, active } : item)
    await localDatabase.write('products', next)
    return next.find(item => item.id === id)
  },
  async remove(id) {
    if (usingApi) return apiClient.delete(`${APP_CONFIG.endpoints.adminProducts}/${id}`)
    const products = await localDatabase.read('products')
    await localDatabase.write('products', products.filter(item => item.id !== id))
  },
  async listCategories({ admin = false } = {}) {
    if (!usingApi) return CATALOG_OPTIONS.categories.map(item => ({ id: item.value, name: item.label, slug: item.value }))
    return unwrapList(await apiClient.get(admin ? APP_CONFIG.endpoints.adminCategories : APP_CONFIG.endpoints.categories))
  },
  async createCategory(name, active = true) {
    if (!usingApi) return { id: crypto.randomUUID(), name, slug: name.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), active, createdAt: new Date().toISOString() }
    return (await apiClient.post(APP_CONFIG.endpoints.adminCategories, { name, active }))?.data
  },
  async updateCategory(category) {
    if (!usingApi) return category
    await apiClient.patch(`${APP_CONFIG.endpoints.adminCategories}/${category.id}`, { name: category.name, active: category.active })
    return category
  },
  async deleteCategory(id) {
    if (!usingApi) return null
    return apiClient.delete(`${APP_CONFIG.endpoints.adminCategories}/${id}`)
  },
  async listMarketplaces({ admin = false } = {}) {
    if (!usingApi) return CATALOG_OPTIONS.marketplaces.map(name => ({ id: name, name, slug: name.toLowerCase().replaceAll(' ', '-') }))
    return unwrapList(await apiClient.get(admin ? APP_CONFIG.endpoints.adminMarketplaces : APP_CONFIG.endpoints.marketplaces))
  },
  async createMarketplace({ name, active = true }) {
    if (!usingApi) return { id: crypto.randomUUID(), name, slug: name.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), active }
    return (await apiClient.post(APP_CONFIG.endpoints.adminMarketplaces, { name, active }))?.data
  },
  async updateMarketplace(marketplace) {
    if (!usingApi) return marketplace
    await apiClient.patch(`${APP_CONFIG.endpoints.adminMarketplaces}/${marketplace.id}`, { name: marketplace.name, active: marketplace.active })
    return marketplace
  },
  async deleteMarketplace(id) {
    if (!usingApi) return null
    return apiClient.delete(`${APP_CONFIG.endpoints.adminMarketplaces}/${id}`)
  },
}
