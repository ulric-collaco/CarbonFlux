/**
 * CarbonFlux — Cloudflare Worker
 *
 * Merged backend + blockchain layer.
 * Handles: payload validation, nonce dedup, blockchain append, violation flagging.
 *
 * KV keys:
 *   "chain"    → JSON array of blocks
 *   "readings" → JSON array of last 200 validated readings
 *   "nonces"   → JSON array of seen nonces (sliding window, last 1000)
 *
 * Endpoints:
 *   POST /ingest          — receive payload from Flutter app
 *   GET  /readings        — recent validated readings (for frontend polling)
 *   GET  /chain           — full blockchain
 *   GET  /latest?n=20     — last N blocks
 *   GET  /violations      — blocks flagged as VIOLATION
 *   GET  /incidents       — incident list (open/resolved/all)
 *   GET  /incident-stats  — incident overview metrics
 *   POST /incidents/:id/acknowledge — acknowledge an open incident
 *   POST /incidents/:id/resolve     — resolve an incident manually
 *   GET  /status          — health check
 */

const MAX_READINGS = 200;
const MAX_NONCES = 1000;
const MAX_CHAIN_RESPONSE = 500;
const MAX_INCIDENTS = 1000;

// ─── CORS helpers ────────────────────────────────────────────────────────────

function getCorsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = [
    env.CORS_ORIGIN || '',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const allowedOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(message, status, corsHeaders = {}) {
  return jsonResponse({ error: message, status }, status, corsHeaders);
}

// ─── Crypto helpers (Web Crypto API — available in Workers) ──────────────────

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Validation ───────────────────────────────────────────────────────────────

async function validatePayload(payload, env) {
  const { device_id, timestamp, nonce, ppm_value, avg_ppm, data_hash, signature } = payload;

  // 1. Required fields
  if (!device_id || timestamp == null || nonce == null || ppm_value == null || avg_ppm == null || !data_hash || !signature) {
    return { valid: false, reason: 'Missing required fields' };
  }

  // 2. Timestamp window ±5 minutes
  const now = Math.floor(Date.now() / 1000);
  const windowSecs = parseInt(env.TIMESTAMP_WINDOW_SECONDS || '300', 10);
  if (Math.abs(now - timestamp) > windowSecs) {
    return { valid: false, reason: `Timestamp out of window (±${windowSecs}s)` };
  }

  // 3. Recompute SHA-256 hash
  // Hash is computed over the core fields serialized deterministically
  const canonicalPayload = JSON.stringify({
    device_id,
    timestamp,
    nonce,
    ppm_value,
    avg_ppm,
  });
  const expectedHash = await sha256Hex(canonicalPayload);
  if (expectedHash !== data_hash) {
    return { valid: false, reason: 'Hash mismatch — data integrity check failed' };
  }

  // 4. Verify HMAC signature
  const expectedSig = await hmacSha256Hex(env.HMAC_SECRET, data_hash);
  if (expectedSig !== signature) {
    return { valid: false, reason: 'Signature mismatch — authentication failed' };
  }

  // 5. Nonce replay check
  const noncesRaw = await env.CARBONFLUX_KV.get('nonces');
  const nonces = noncesRaw ? JSON.parse(noncesRaw) : [];
  const nonceStr = String(nonce);
  if (nonces.includes(nonceStr)) {
    return { valid: false, reason: 'Replay attack detected — nonce already seen' };
  }

  return { valid: true, nonces, nonceStr };
}

// ─── Blockchain ───────────────────────────────────────────────────────────────

async function appendBlock(env, reading) {
  const { device_id, timestamp, ppm_value, data_hash } = reading;
  const chainRaw = await env.CARBONFLUX_KV.get('chain');
  const chain = chainRaw ? JSON.parse(chainRaw) : [];

  const index = chain.length;
  const previous_hash = index === 0 ? '0'.repeat(64) : chain[chain.length - 1].block_hash;
  const violationThreshold = parseInt(env.PPM_VIOLATION_THRESHOLD || '1000', 10);
  const isViolation = ppm_value > violationThreshold;

  // block_hash = SHA-256(index + previous_hash + timestamp + data_hash)
  const blockHashInput = `${index}${previous_hash}${timestamp}${data_hash}`;
  const block_hash = await sha256Hex(blockHashInput);

  const block = {
    index,
    previous_hash,
    timestamp,
    device_id,
    ppm_value,
    avg_ppm: reading.avg_ppm,
    data_hash,
    block_hash,
    violation: isViolation,
    violation_label: isViolation ? 'VIOLATION' : 'COMPLIANT',
  };

  chain.push(block);

  // Trim chain if > MAX_CHAIN_RESPONSE to save KV storage (keep all for audit)
  await env.CARBONFLUX_KV.put('chain', JSON.stringify(chain));
  return block;
}

async function getChain(env) {
  const raw = await env.CARBONFLUX_KV.get('chain');
  return raw ? JSON.parse(raw) : [];
}

async function verifyChain(chain) {
  if (chain.length === 0) return { valid: true, results: [] };

  const results = [];
  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];
    const expectedPrevHash = i === 0 ? '0'.repeat(64) : chain[i - 1].block_hash;
    const blockHashInput = `${block.index}${expectedPrevHash}${block.timestamp}${block.data_hash}`;
    const expectedBlockHash = await sha256Hex(blockHashInput);

    const prevHashMatch = block.previous_hash === expectedPrevHash;
    const blockHashMatch = block.block_hash === expectedBlockHash;
    const valid = prevHashMatch && blockHashMatch;

    results.push({
      index: block.index,
      valid,
      prevHashMatch,
      blockHashMatch,
      device_id: block.device_id,
      ppm_value: block.ppm_value,
      timestamp: block.timestamp,
      block_hash: block.block_hash,
      violation: block.violation,
    });
  }

  const chainValid = results.every((r) => r.valid);
  return { valid: chainValid, results };
}

// ─── Incident lifecycle ──────────────────────────────────────────────────────

const SEVERITY_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function normalizeSeverity(value) {
  if (!value) return 'LOW';
  const upper = String(value).toUpperCase();
  return SEVERITY_RANK[upper] ? upper : 'LOW';
}

function pickHigherSeverity(current, candidate) {
  const currentNormalized = normalizeSeverity(current);
  const candidateNormalized = normalizeSeverity(candidate);
  return SEVERITY_RANK[candidateNormalized] > SEVERITY_RANK[currentNormalized]
    ? candidateNormalized
    : currentNormalized;
}

function evaluateSeverity(ppmValue, threshold, durationSeconds) {
  const ratio = threshold > 0 ? ppmValue / threshold : 0;
  if (ratio >= 2 || durationSeconds >= 120) return 'CRITICAL';
  if (ratio >= 1.5 || durationSeconds >= 60) return 'HIGH';
  if (ratio >= 1.2 || durationSeconds >= 30) return 'MEDIUM';
  return 'LOW';
}

function buildIncidentId(deviceId, nowMs) {
  const safeDevice = String(deviceId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'unknown';
  const entropy = Math.random().toString(16).slice(2, 10);
  return `inc_${safeDevice}_${nowMs}_${entropy}`;
}

function parseBooleanEnv(value, defaultValue) {
  if (value == null) return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

async function getIncidents(env) {
  const raw = await env.CARBONFLUX_KV.get('incidents');
  return raw ? JSON.parse(raw) : [];
}

async function storeIncidents(env, incidents) {
  const copy = Array.isArray(incidents) ? [...incidents] : [];

  while (copy.length > MAX_INCIDENTS) {
    const resolvedIdx = copy.findIndex((incident) => incident.status === 'RESOLVED');
    if (resolvedIdx >= 0) copy.splice(resolvedIdx, 1);
    else copy.shift();
  }

  await env.CARBONFLUX_KV.put('incidents', JSON.stringify(copy));
  return copy;
}

async function processIncidentLifecycle(env, reading, nowMs) {
  const threshold = parseInt(env.PPM_VIOLATION_THRESHOLD || '500', 10);
  const sustainedWindowSecs = parseInt(env.INCIDENT_SUSTAINED_SECONDS || '30', 10);
  const autoResolve = parseBooleanEnv(env.INCIDENT_AUTO_RESOLVE, true);
  const ppmValue = Number(reading.ppm_value);

  if (!Number.isFinite(ppmValue)) {
    return { action: 'none', incident: null };
  }

  const incidents = await getIncidents(env);
  const openIncident = incidents.find(
    (incident) => incident.status === 'OPEN'
      && incident.type === 'PPM_THRESHOLD_EXCEEDED'
      && incident.device_id === reading.device_id,
  );

  if (ppmValue > threshold) {
    if (!openIncident) {
      const created = {
        id: buildIncidentId(reading.device_id, nowMs),
        type: 'PPM_THRESHOLD_EXCEEDED',
        status: 'OPEN',
        severity: evaluateSeverity(ppmValue, threshold, 0),
        device_id: reading.device_id,
        threshold_ppm: threshold,
        latest_ppm: ppmValue,
        peak_ppm: ppmValue,
        sample_count: 1,
        sustained: false,
        duration_seconds: 0,
        triggered_at: nowMs,
        last_seen_at: nowMs,
        updated_at: nowMs,
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
        notes: [],
      };

      incidents.push(created);
      await storeIncidents(env, incidents);
      return { action: 'created', incident: created };
    }

    const durationSeconds = Math.max(0, Math.floor((nowMs - openIncident.triggered_at) / 1000));
    const evaluatedSeverity = evaluateSeverity(ppmValue, threshold, durationSeconds);

    openIncident.latest_ppm = ppmValue;
    openIncident.peak_ppm = Math.max(openIncident.peak_ppm || ppmValue, ppmValue);
    openIncident.sample_count = (openIncident.sample_count || 0) + 1;
    openIncident.duration_seconds = durationSeconds;
    openIncident.sustained = durationSeconds >= sustainedWindowSecs;
    openIncident.last_seen_at = nowMs;
    openIncident.updated_at = nowMs;
    openIncident.severity = pickHigherSeverity(openIncident.severity, evaluatedSeverity);

    await storeIncidents(env, incidents);
    return { action: 'updated', incident: openIncident };
  }

  if (openIncident && autoResolve) {
    openIncident.status = 'RESOLVED';
    openIncident.resolved_at = nowMs;
    openIncident.resolved_by = 'system';
    openIncident.resolution = 'AUTO_RECOVERY';
    openIncident.resolution_note = 'PPM returned to compliant range';
    openIncident.latest_ppm = ppmValue;
    openIncident.last_seen_at = nowMs;
    openIncident.updated_at = nowMs;
    openIncident.duration_seconds = Math.max(0, Math.floor((nowMs - openIncident.triggered_at) / 1000));

    await storeIncidents(env, incidents);
    return { action: 'resolved', incident: openIncident };
  }

  return { action: 'none', incident: null };
}

function computeIncidentStats(incidents) {
  const now = Date.now();
  const open = incidents.filter((incident) => incident.status === 'OPEN');
  const resolved = incidents.filter((incident) => incident.status === 'RESOLVED');
  const openUnacknowledged = open.filter((incident) => !incident.acknowledged);
  const openCritical = open.filter((incident) => normalizeSeverity(incident.severity) === 'CRITICAL');
  const activeDevices = new Set(open.map((incident) => incident.device_id)).size;
  const inLast24h = incidents.filter((incident) => now - (incident.triggered_at || 0) <= 24 * 60 * 60 * 1000);

  return {
    total: incidents.length,
    open: open.length,
    resolved: resolved.length,
    open_unacknowledged: openUnacknowledged.length,
    open_critical: openCritical.length,
    active_devices: activeDevices,
    triggered_last_24h: inLast24h.length,
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleIngest(request, env, corsHeaders) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const validation = await validatePayload(payload, env);
  if (!validation.valid) {
    return jsonResponse(
      { success: false, error: validation.reason, code: 'VALIDATION_FAILED' },
      422,
      corsHeaders,
    );
  }

  // Store nonce (sliding window)
  const updatedNonces = [...validation.nonces, validation.nonceStr];
  if (updatedNonces.length > MAX_NONCES) updatedNonces.splice(0, updatedNonces.length - MAX_NONCES);
  await env.CARBONFLUX_KV.put('nonces', JSON.stringify(updatedNonces));

  // Store reading
  const readingsRaw = await env.CARBONFLUX_KV.get('readings');
  const readings = readingsRaw ? JSON.parse(readingsRaw) : [];
  const receivedAt = Date.now();
  const readingRecord = {
    ...payload,
    received_at: receivedAt,
    validated: true,
  };
  readings.push(readingRecord);
  if (readings.length > MAX_READINGS) readings.splice(0, readings.length - MAX_READINGS);
  await env.CARBONFLUX_KV.put('readings', JSON.stringify(readings));

  // Append to blockchain
  const block = await appendBlock(env, payload);
  const incidentResult = await processIncidentLifecycle(env, payload, receivedAt);

  return jsonResponse(
    {
      success: true,
      block_index: block.index,
      block_hash: block.block_hash,
      violation: block.violation,
      violation_label: block.violation_label,
      incident_update: incidentResult.action,
      incident: incidentResult.incident
        ? {
          id: incidentResult.incident.id,
          status: incidentResult.incident.status,
          severity: incidentResult.incident.severity,
          acknowledged: incidentResult.incident.acknowledged,
        }
        : null,
      message: block.violation
        ? '⚠ VIOLATION RECORDED — PPM exceeds threshold'
        : '✓ Reading validated and added to chain',
    },
    200,
    corsHeaders,
  );
}

async function handleReadings(request, env, corsHeaders) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const raw = await env.CARBONFLUX_KV.get('readings');
  const readings = raw ? JSON.parse(raw) : [];
  const recent = readings.slice(-limit).reverse();

  return jsonResponse({ readings: recent, total: readings.length }, 200, corsHeaders);
}

async function handleChain(request, env, corsHeaders) {
  const chain = await getChain(env);
  return jsonResponse({ chain, length: chain.length }, 200, corsHeaders);
}

async function handleLatest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const n = Math.min(parseInt(url.searchParams.get('n') || '20', 10), 100);
  const chain = await getChain(env);
  const latest = chain.slice(-n).reverse();
  return jsonResponse({ blocks: latest, total: chain.length }, 200, corsHeaders);
}

async function handleViolations(request, env, corsHeaders) {
  const chain = await getChain(env);
  const violations = chain.filter((b) => b.violation).reverse();
  return jsonResponse({ violations, total: violations.length }, 200, corsHeaders);
}

async function handleIncidents(request, env, corsHeaders) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const statusFilter = String(url.searchParams.get('status') || 'all').toUpperCase();
  const deviceFilter = url.searchParams.get('device_id');

  const incidents = await getIncidents(env);
  const filtered = incidents
    .filter((incident) => {
      if (statusFilter === 'OPEN' && incident.status !== 'OPEN') return false;
      if (statusFilter === 'RESOLVED' && incident.status !== 'RESOLVED') return false;
      if (statusFilter === 'UNACKNOWLEDGED' && (incident.status !== 'OPEN' || incident.acknowledged)) return false;
      if (deviceFilter && incident.device_id !== deviceFilter) return false;
      return true;
    })
    .sort((a, b) => (b.updated_at || b.triggered_at || 0) - (a.updated_at || a.triggered_at || 0));

  return jsonResponse(
    {
      incidents: filtered.slice(0, limit),
      total: filtered.length,
      overall_total: incidents.length,
      status_filter: statusFilter,
    },
    200,
    corsHeaders,
  );
}

async function handleIncidentAction(request, env, corsHeaders, incidentId, action) {
  let body = {};
  try {
    const rawBody = await request.text();
    if (rawBody.trim()) {
      body = JSON.parse(rawBody);
    }
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const actor = String(body.actor || 'operator').slice(0, 64);
  const note = body.note == null ? '' : String(body.note).slice(0, 240);

  const incidents = await getIncidents(env);
  const incident = incidents.find((item) => item.id === incidentId);
  if (!incident) {
    return errorResponse('Incident not found', 404, corsHeaders);
  }

  const nowMs = Date.now();

  if (action === 'acknowledge') {
    if (incident.status !== 'OPEN') {
      return errorResponse('Only open incidents can be acknowledged', 409, corsHeaders);
    }
    incident.acknowledged = true;
    incident.acknowledged_by = actor;
    incident.acknowledged_at = nowMs;
    incident.updated_at = nowMs;
    if (note) {
      incident.notes = Array.isArray(incident.notes) ? incident.notes : [];
      incident.notes.push({ type: 'ACK', actor, note, at: nowMs });
    }
  }

  if (action === 'resolve') {
    if (incident.status !== 'RESOLVED') {
      incident.status = 'RESOLVED';
      incident.resolved_at = nowMs;
      incident.resolved_by = actor;
      incident.resolution = 'MANUAL_RESOLUTION';
      incident.resolution_note = note || 'Resolved by operator';
      incident.updated_at = nowMs;
      incident.duration_seconds = Math.max(0, Math.floor((nowMs - incident.triggered_at) / 1000));
      if (note) {
        incident.notes = Array.isArray(incident.notes) ? incident.notes : [];
        incident.notes.push({ type: 'RESOLVE', actor, note, at: nowMs });
      }
    }
  }

  await storeIncidents(env, incidents);
  return jsonResponse({ success: true, incident }, 200, corsHeaders);
}

async function handleIncidentStats(env, corsHeaders) {
  const incidents = await getIncidents(env);
  return jsonResponse({ stats: computeIncidentStats(incidents) }, 200, corsHeaders);
}

async function handleAudit(request, env, corsHeaders) {
  const chain = await getChain(env);
  const result = await verifyChain(chain);
  return jsonResponse(
    { ...result, chain_length: chain.length, audited_at: Date.now() },
    200,
    corsHeaders,
  );
}

async function handleStatus(env, corsHeaders) {
  const chainRaw = await env.CARBONFLUX_KV.get('chain');
  const readingsRaw = await env.CARBONFLUX_KV.get('readings');
  const incidentsRaw = await env.CARBONFLUX_KV.get('incidents');
  const chain = chainRaw ? JSON.parse(chainRaw) : [];
  const readings = readingsRaw ? JSON.parse(readingsRaw) : [];
  const incidents = incidentsRaw ? JSON.parse(incidentsRaw) : [];
  const violations = chain.filter((b) => b.violation).length;
  const incidentStats = computeIncidentStats(incidents);

  return jsonResponse(
    {
      status: 'ok',
      chain_length: chain.length,
      readings_count: readings.length,
      violations_count: violations,
      incidents_open: incidentStats.open,
      incidents_unacknowledged: incidentStats.open_unacknowledged,
      incidents_total: incidentStats.total,
      timestamp: Date.now(),
    },
    200,
    corsHeaders,
  );
}

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(env, request);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const acknowledgeMatch = path.match(/^\/incidents\/([^/]+)\/acknowledge$/);
    const resolveMatch = path.match(/^\/incidents\/([^/]+)\/resolve$/);

    try {
      if (path === '/ingest' && method === 'POST') return handleIngest(request, env, corsHeaders);
      if (path === '/readings' && method === 'GET') return handleReadings(request, env, corsHeaders);
      if (path === '/chain' && method === 'GET') return handleChain(request, env, corsHeaders);
      if (path === '/latest' && method === 'GET') return handleLatest(request, env, corsHeaders);
      if (path === '/violations' && method === 'GET') return handleViolations(request, env, corsHeaders);
      if (path === '/incidents' && method === 'GET') return handleIncidents(request, env, corsHeaders);
      if (path === '/incident-stats' && method === 'GET') return handleIncidentStats(env, corsHeaders);
      if (acknowledgeMatch && method === 'POST') {
        return handleIncidentAction(
          request,
          env,
          corsHeaders,
          decodeURIComponent(acknowledgeMatch[1]),
          'acknowledge',
        );
      }
      if (resolveMatch && method === 'POST') {
        return handleIncidentAction(
          request,
          env,
          corsHeaders,
          decodeURIComponent(resolveMatch[1]),
          'resolve',
        );
      }
      if (path === '/audit' && method === 'GET') return handleAudit(request, env, corsHeaders);
      if (path === '/status' && method === 'GET') return handleStatus(env, corsHeaders);

      return errorResponse('Not found', 404, corsHeaders);
    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse('Internal server error', 500, corsHeaders);
    }
  },
};
