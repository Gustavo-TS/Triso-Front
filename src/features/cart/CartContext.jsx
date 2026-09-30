import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { catalogService } from '../../services/catalogService.js'
import { readCart, writeCart } from './cartStorage.js'
import { productCents } from './cartValidation.js'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart)
  const [products, setProducts] = useState([])
  const [issues, setIssues] = useState([])
  const [ready, setReady] = useState(false)
  const refresh = useCallback(async () => {
    try {
      const current = await catalogService.list()
      const byId = new Map(current.filter(product => product.active).map(product => [String(product.id), product]))
      setProducts(current)
      setItems(previous => {
        const missing = previous.filter(item => !byId.has(item.productId)).map(item => item.productId)
        if (missing.length) setIssues(missing.map(() => 'Um produto indisponível foi removido do carrinho.'))
        return previous.filter(item => byId.has(item.productId))
      })
    } finally { setReady(true) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { writeCart(items) }, [items])
  useEffect(() => {
    const onStorage = event => { if (event.key === 'triso_cart_v1') setItems(readCart()) }
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage)
  }, [])
  const add = useCallback((productId, quantity = 1) => setItems(previous => {
    const id = String(productId || '').trim(); const increment = Number(quantity)
    if (!id || !Number.isInteger(increment) || increment < 1) return previous
    const exists = previous.find(item => item.productId === id)
    return exists ? previous.map(item => item.productId === id ? { ...item, quantity: item.quantity + increment } : item) : [...previous, { productId: id, quantity: increment }]
  }), [])
  const setQuantity = useCallback((productId, quantity) => setItems(previous => {
    const next = Number(quantity); if (!Number.isInteger(next) || next < 1) return previous
    return previous.map(item => item.productId === String(productId) ? { ...item, quantity: next } : item)
  }), [])
  const remove = useCallback(productId => setItems(previous => previous.filter(item => item.productId !== String(productId))), [])
  const clearPurchased = useCallback(purchased => setItems(previous => previous.filter(item => !purchased.some(line => String(line.productId) === item.productId && line.quantity >= item.quantity))), [])
  const lines = useMemo(() => items.map(item => ({ ...item, product: products.find(product => String(product.id) === item.productId) })).filter(line => line.product), [items, products])
  const totalItems = items.reduce((total, item) => total + item.quantity, 0)
  const value = useMemo(() => ({ items, lines, ready, issues, totalQuantity: totalItems, totalItems, subtotalCents: lines.reduce((total, line) => total + productCents(line.product) * line.quantity, 0), add, addItem: add, setQuantity, updateQuantity: setQuantity, remove, removeItem: remove, clear: () => setItems([]), clearCart: () => setItems([]), getItemQuantity: productId => items.find(item => item.productId === String(productId))?.quantity || 0, clearPurchased, refresh, dismissIssues: () => setIssues([]) }), [items, lines, ready, issues, totalItems, add, setQuantity, remove, clearPurchased, refresh])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export const useCart = () => { const context = useContext(CartContext); if (!context) throw new Error('CartProvider ausente.'); return context }
