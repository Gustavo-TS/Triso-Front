export const APP_CONFIG = {
  dataSource: import.meta.env.VITE_DATA_SOURCE || 'api',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5266').replace(/\/$/, ''),
  locale: 'pt-BR',
  currency: 'BRL',
  adminAccountLabel: 'Conta administrativa',
  storage: {
    products: 'triso-products-v3',
    clicks: 'triso-marketplace-clicks-v2',
    session: 'triso-admin-session-v2',
  },
  endpoints: {
    catalogProducts: '/api/v1/catalog/products',
    categories: '/api/v1/catalog/categories',
    marketplaces: '/api/v1/catalog/marketplaces',
    marketplaceClicks: '/api/v1/events/marketplace-clicks',
    adminProducts: '/api/v1/admin/products',
    adminCategories: '/api/v1/admin/categories',
    analyticsDashboard: '/api/v1/admin/analytics/dashboard',
    login: '/api/v1/auth/login',
    session: '/api/v1/auth/session',
    logout: '/api/v1/auth/logout',
  },
}

export const CATALOG_OPTIONS = {
  categories: [
    { value: 'decoracao', label: 'Decoração' },
    { value: 'setup', label: 'Setup & Office' },
    { value: 'organizacao', label: 'Organização' },
    { value: 'outros', label: 'Outros' },
  ],
  marketplaces: ['Mercado Livre', 'Shopee', 'Elo7', 'Amazon', 'Outro'],
  visuals: [
    { value: 'vase', label: 'Vaso' }, { value: 'orbit', label: 'Orbit' },
    { value: 'dock', label: 'Dock' }, { value: 'tray', label: 'Bandeja' },
    { value: 'lamp', label: 'Luminária' }, { value: 'stand', label: 'Stand' },
  ],
  productDefaults: { name: '', categoryId: '', category: '', price: '', badge: '', description: '', marketplaces: [], imageUrl: '', art: 'vase', status: 'published', active: true },
}

export const CATEGORY_LABELS = Object.fromEntries(CATALOG_OPTIONS.categories.map(item => [item.value, item.label]))
