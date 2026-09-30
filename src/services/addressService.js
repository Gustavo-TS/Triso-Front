import { apiClient } from '../lib/apiClient.js'

const PATH = '/api/v1/account/addresses'
const unwrap = body => body?.data ?? body

export const addressService = {
  list: signal => apiClient.get(PATH, { signal }).then(unwrap),
  create: payload => apiClient.post(PATH, payload).then(unwrap),
  update: (id, payload) => apiClient.put(`${PATH}/${id}`, payload).then(unwrap),
  remove: id => apiClient.delete(`${PATH}/${id}`),
}
