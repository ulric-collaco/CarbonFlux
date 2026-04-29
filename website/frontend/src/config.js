// CarbonFlux API base URL
// Swap to your deployed CF Worker URL after `wrangler deploy`
export const API_BASE = import.meta.env.VITE_API_BASE || 'https://carbonflux-worker.collacou.workers.dev'

export const PPM_VIOLATION_THRESHOLD = 500
export const POLL_INTERVAL_MS = 2000
