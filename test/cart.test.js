import test from 'node:test'
import assert from 'node:assert/strict'
import { CART_KEY, readCart, writeCart } from '../src/features/cart/cartStorage.js'
import { formatCurrency } from '../src/features/cart/cartValidation.js'

const values = new Map()
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }

test('persiste somente productId e quantity válidos', () => {
  writeCart([{ productId: 'produto-1', quantity: 2, productName: 'não deve persistir' }])
  assert.deepEqual(JSON.parse(values.get(CART_KEY)), [{ productId: 'produto-1', quantity: 2 }])
  assert.deepEqual(readCart(), [{ productId: 'produto-1', quantity: 2 }])
})

test('descarta itens inválidos restaurados', () => {
  values.set(CART_KEY, JSON.stringify([{ productId: 'ok', quantity: 1 }, { productId: 'zero', quantity: 0 }, { productId: '', quantity: 3 }]))
  assert.deepEqual(readCart(), [{ productId: 'ok', quantity: 1 }])
})

test('formata centavos sem ponto flutuante de domínio', () => {
  assert.equal(formatCurrency(12345), 'R$ 123,45')
})
