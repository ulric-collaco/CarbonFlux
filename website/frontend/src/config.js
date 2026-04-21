// CarbonFlux API base URL
// Swap to your deployed CF Worker URL after `wrangler deploy`
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787'

export const PPM_VIOLATION_THRESHOLD = 1000
export const POLL_INTERVAL_MS = 2000
