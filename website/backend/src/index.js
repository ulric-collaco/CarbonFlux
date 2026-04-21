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
 *   GET  /status          — health check
 */

const MAX_READINGS = 200;
const MAX_NONCES = 1000;
const MAX_CHAIN_RESPONSE = 500;

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
  const readingRecord = {
    ...payload,
    received_at: Date.now(),
    validated: true,
  };
  readings.push(readingRecord);
  if (readings.length > MAX_READINGS) readings.splice(0, readings.length - MAX_READINGS);
  await env.CARBONFLUX_KV.put('readings', JSON.stringify(readings));

  // Append to blockchain
  const block = await appendBlock(env, payload);

  return jsonResponse(
    {
      success: true,
      block_index: block.index,
      block_hash: block.block_hash,
      violation: block.violation,
      violation_label: block.violation_label,
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
  const chain = chainRaw ? JSON.parse(chainRaw) : [];
  const readings = readingsRaw ? JSON.parse(readingsRaw) : [];
  const violations = chain.filter((b) => b.violation).length;

  return jsonResponse(
    {
      status: 'ok',
      chain_length: chain.length,
      readings_count: readings.length,
      violations_count: violations,
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

    try {
      if (path === '/ingest' && method === 'POST') return handleIngest(request, env, corsHeaders);
      if (path === '/readings' && method === 'GET') return handleReadings(request, env, corsHeaders);
      if (path === '/chain' && method === 'GET') return handleChain(request, env, corsHeaders);
      if (path === '/latest' && method === 'GET') return handleLatest(request, env, corsHeaders);
      if (path === '/violations' && method === 'GET') return handleViolations(request, env, corsHeaders);
      if (path === '/audit' && method === 'GET') return handleAudit(request, env, corsHeaders);
      if (path === '/status' && method === 'GET') return handleStatus(env, corsHeaders);

      return errorResponse('Not found', 404, corsHeaders);
    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse('Internal server error', 500, corsHeaders);
    }
  },
};
