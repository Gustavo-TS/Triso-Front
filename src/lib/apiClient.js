import { APP_CONFIG } from '../config/app.js'

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.name = 'ApiError'; this.status = status; this.details = details }
}

async function request(path, options = {}) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const validationMessage = body?.errors && Object.values(body.errors).flat().join(' ')
    throw new ApiError(validationMessage || body?.message || body?.title || 'Não foi possível concluir a solicitação.', response.status, body)
  }
  return body
}

export const apiClient = {
  get: path => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: path => request(path, { method: 'DELETE' }),
}
