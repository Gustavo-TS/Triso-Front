const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5266'

const resolveApiBaseUrl = value => {
  const url = new URL(value)

  // Ao abrir o Vite por outro dispositivo da rede, "localhost" apontaria
  // para esse dispositivo. Mantemos a porta da API e usamos o host que
  // realmente serviu o frontend.
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
    const frontendHost = window.location.hostname
    if (!['localhost', '127.0.0.1'].includes(frontendHost)) url.hostname = frontendHost
  }

  return url.toString().replace(/\/$/, '')
}

export const APP_CONFIG = {
  dataSource: import.meta.env.VITE_DATA_SOURCE || 'api',
  apiBaseUrl: resolveApiBaseUrl(configuredApiBaseUrl),
  locale: 'pt-BR',
  currency: 'BRL',
  adminAccountLabel: 'Conta administrativa',
  storage: {
    products: 'triso-products-v3',
    session: 'triso-admin-session-v2',
  },
  endpoints: {
    catalogProducts: '/api/v1/catalog/products',
    categories: '/api/v1/catalog/categories',
    adminProducts: '/api/v1/admin/products',
    adminCategories: '/api/v1/admin/categories',
    adminUsers: '/api/v1/admin/users',
    adminPermissions: '/api/v1/admin/permissions',
    adminOrders: '/api/v1/admin/orders',
    adminDashboard: '/api/v1/admin/dashboard',
    adminTasks: '/api/v1/admin/tasks',
    drAlfredoDownloads: '/api/v1/campaigns/dralfredo/downloads',
    login: '/api/v1/auth/login',
    session: '/api/v1/auth/session',
    logout: '/api/v1/auth/logout',
    register: '/api/v1/auth/register',
    profile: '/api/v1/account/profile',
    orders: '/api/v1/orders',
    accountOrders: '/api/v1/account/orders',
  },
}

export const CATALOG_OPTIONS = {
  categories: [
    { value: 'decoracao', label: 'Decoração' },
    { value: 'setup', label: 'Setup & Office' },
    { value: 'organizacao', label: 'Organização' },
    { value: 'outros', label: 'Outros' },
  ],
  visuals: [
    { value: 'vase', label: 'Vaso' }, { value: 'orbit', label: 'Orbit' },
    { value: 'dock', label: 'Dock' }, { value: 'tray', label: 'Bandeja' },
    { value: 'lamp', label: 'Luminária' }, { value: 'stand', label: 'Stand' },
  ],
  productDefaults: { name: '', categoryId: '', category: '', price: '', badge: '', description: '', imageUrl: '', art: 'vase', status: 'published', active: true, requiresShipping: true, weightGrams: '', widthCm: '', heightCm: '', lengthCm: '' },
}

export const CATEGORY_LABELS = Object.fromEntries(CATALOG_OPTIONS.categories.map(item => [item.value, item.label]))
