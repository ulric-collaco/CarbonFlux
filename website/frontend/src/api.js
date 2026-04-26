import { API_BASE } from './config.js'

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function post(path, payload = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
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
  incidents: (status = 'all', limit = 100) => get(`/incidents?status=${encodeURIComponent(status)}&limit=${limit}`),
  incidentStats: () => get('/incident-stats'),
  acknowledgeIncident: (incidentId, actor, note = '') => post(`/incidents/${encodeURIComponent(incidentId)}/acknowledge`, { actor, note }),
  resolveIncident: (incidentId, actor, note = '') => post(`/incidents/${encodeURIComponent(incidentId)}/resolve`, { actor, note }),
}
