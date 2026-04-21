import { API_BASE } from './config.js'

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const api = {
  status: () => get('/status'),
  readings: (limit = 50) => get(`/readings?limit=${limit}`),
  chain: () => get('/chain'),
  latest: (n = 20) => get(`/latest?n=${n}`),
  violations: () => get('/violations'),
  audit: () => get('/audit'),
}
