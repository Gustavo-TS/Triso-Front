export const CART_KEY = 'triso_cart_v1'

export function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(item => item && item.productId && Number.isInteger(item.quantity) && item.quantity > 0).map(item => ({ productId: String(item.productId), quantity: item.quantity })) : []
  } catch { return [] }
}

export function writeCart(items) { localStorage.setItem(CART_KEY, JSON.stringify(items.map(({ productId, quantity }) => ({ productId, quantity })))) }
