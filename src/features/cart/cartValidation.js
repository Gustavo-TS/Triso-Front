export const formatCurrency = priceCents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number.isSafeInteger(priceCents) ? priceCents : 0) / 100)
export const productCents = product => Number.isSafeInteger(product?.priceCents) ? product.priceCents : Math.round(Number(product?.price || 0) * 100)
