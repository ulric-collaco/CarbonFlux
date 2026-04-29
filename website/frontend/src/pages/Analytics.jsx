import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Area, ComposedChart,
} from 'recharts'
import { api } from '../api.js'
import { PPM_VIOLATION_THRESHOLD } from '../config.js'

const WINDOW_OPTIONS = [
  { label: '50 READINGS', value: 50 },
  { label: '120 READINGS', value: 120 },
  { label: '200 READINGS', value: 200 },
]

const BUCKET_SIZE = 50

function fmt(v, d = 1) {
  return Number.isFinite(v) ? v.toFixed(d) : '-'
}

function durationLabel(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

/* ── Histogram tooltip ───────────────────────────────────────────── */
function HistogramTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#111', border: '1px solid #2a2a2a', padding: '10px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <div style={{ color: '#555', marginBottom: 4, letterSpacing: '0.1em' }}>
        {d.range}
      </div>
      <div style={{ color: d.isViolation ? '#FF2D2D' : '#00AAFF', fontSize: 18, fontFamily: 'var(--font-display)' }}>
        {d.count} <span style={{ fontSize: 10, color: '#555' }}>readings</span>
      </div>
      <div style={{ color: '#555', marginTop: 2, fontSize: 10 }}>
        {d.pct}% of total
      </div>
    </div>
  )
}

/* ── Trend tooltip ───────────────────────────────────────────────── */
function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#111', border: '1px solid #2a2a2a', padding: '10px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <div style={{ color: '#555', marginBottom: 4, letterSpacing: '0.1em' }}>
        {d.time}
      </div>
      <div style={{ color: d.ppm > PPM_VIOLATION_THRESHOLD ? '#FF2D2D' : '#00FF6A', fontSize: 15 }}>
        {fmt(d.ppm, 2)} <span style={{ fontSize: 10, color: '#555' }}>ppm</span>
      </div>
      {d.ma != null && (
        <div style={{ color: '#FFD600', marginTop: 2 }}>
          MA₁₀: {fmt(d.ma, 2)} ppm
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Analytics() {
  const [windowSize, setWindowSize] = useState(120)
  const [readings, setReadings] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [readingData, statusData] = await Promise.all([
          api.readings(windowSize),
          api.status(),
        ])
        if (cancelled) return
        const list = Array.isArray(readingData.readings)
          ? readingData.readings
          : (Array.isArray(readingData) ? readingData : [])
        setReadings(
          [...list].filter(r => Number.isFinite(Number(r.ppm_value))).reverse()
        )
        setStatus(statusData)
        setError(null)
      } catch {
        if (!cancelled) setError('Unable to load analytics. Check backend connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const timer = setInterval(load, 10_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [windowSize])

  /* ── Computed analytics ─────────────────────────────────────────── */
  const analysis = useMemo(() => {
    const values = readings.map(r => Number(r.ppm_value))
    const total = values.length
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = total ? sum / total : 0
    const max = total ? Math.max(...values) : 0
    const min = total ? Math.min(...values) : 0
    const violations = values.filter(v => v > PPM_VIOLATION_THRESHOLD).length
    const compliant = Math.max(total - violations, 0)
    const complianceRate = total ? (compliant / total) * 100 : 0
    const first = readings[0]
    const latest = readings.at(-1)
    const trendDelta = latest && first
      ? Number(latest.ppm_value) - Number(first.ppm_value) : 0

    // Gaps & volatility
    const swings = []
    for (let i = 1; i < readings.length; i++) {
      swings.push(Math.abs(Number(readings[i].ppm_value) - Number(readings[i - 1].ppm_value)))
    }
    const avgSwing = swings.length ? swings.reduce((a, b) => a + b, 0) / swings.length : 0
    const volatility = clamp((avgSwing / Math.max(PPM_VIOLATION_THRESHOLD * 0.25, 1)) * 100, 0, 100)

    // Standard deviation
    const variance = total ? values.reduce((a, v) => a + (v - avg) ** 2, 0) / total : 0
    const stdDev = Math.sqrt(variance)

    // ── Histogram buckets ──
    const upperBound = Math.max(max + BUCKET_SIZE, PPM_VIOLATION_THRESHOLD + BUCKET_SIZE * 2)
    const bucketCount = Math.ceil(upperBound / BUCKET_SIZE)
    const histogram = Array.from({ length: bucketCount }, (_, i) => {
      const lo = i * BUCKET_SIZE
      const hi = lo + BUCKET_SIZE
      const count = values.filter(v => v >= lo && v < hi).length
      return {
        range: `${lo}–${hi}`,
        rangeShort: `${lo}`,
        lo, hi, count,
        pct: total ? ((count / total) * 100).toFixed(1) : '0',
        isViolation: lo >= PPM_VIOLATION_THRESHOLD,
      }
    }).filter(b => b.count > 0 || b.lo <= upperBound)

    // ── Rolling average trend ──
    const MA_WINDOW = 10
    const trend = readings.map((r, i) => {
      const ppm = Number(r.ppm_value)
      const windowSlice = values.slice(Math.max(0, i - MA_WINDOW + 1), i + 1)
      const ma = windowSlice.length >= MA_WINDOW
        ? windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length
        : null
      const t = r.received_at ? new Date(r.received_at) : null
      return {
        idx: i,
        ppm,
        ma,
        time: t ? t.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `#${i}`,
        isViolation: ppm > PPM_VIOLATION_THRESHOLD,
      }
    })

    // Percentiles
    const sorted = [...values].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0

    return {
      total, avg, max, min, violations, complianceRate, trendDelta,
      volatility, stdDev, histogram, trend, p50, p90, p99,
      latestPpm: latest ? Number(latest.ppm_value) : 0,
      latestDevice: latest?.device_id || '-',
    }
  }, [readings])

  const trendColor = analysis.trendDelta > 0 ? '#FF8C00' : analysis.trendDelta < 0 ? '#00FF6A' : '#888'

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <div className="page-header-row" style={{ gap: 16 }}>
          <div className="page-title">ANALYTICS</div>
          <div style={{
            padding: '6px 10px', border: '1px solid #2a2a2a', color: '#00AAFF',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
          }}>
            {analysis.latestDevice}
          </div>
        </div>
        <div className="page-header-actions">
          {WINDOW_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setWindowSize(o.value)}
              className="filter-btn" style={{
                padding: '9px 14px',
                background: windowSize === o.value ? '#FFD600' : 'transparent',
                border: `2px solid ${windowSize === o.value ? '#FFD600' : '#2a2a2a'}`,
                color: windowSize === o.value ? '#0d0d0d' : '#666',
                fontFamily: 'var(--font-condensed)', fontSize: 11,
                fontWeight: 900, letterSpacing: '0.14em', cursor: 'pointer',
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="page-error-banner" style={{
          background: 'rgba(255,45,45,0.08)', border: '1px solid rgba(255,45,45,0.35)',
          color: '#FF2D2D', fontFamily: 'var(--font-mono)', fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* ── KPI Strip ───────────────────────────────────────────── */}
      <div className="analytics-kpi-grid">
        {[
          { label: 'AVG PPM', value: fmt(analysis.avg, 2), unit: 'ppm', color: '#00AAFF' },
          { label: 'PEAK PPM', value: fmt(analysis.max, 2), unit: 'ppm', color: analysis.max > PPM_VIOLATION_THRESHOLD ? '#FF2D2D' : '#00FF6A' },
          { label: 'COMPLIANCE', value: fmt(analysis.complianceRate, 1), unit: '%', color: analysis.complianceRate >= 95 ? '#00FF6A' : '#FF8C00' },
          { label: 'TREND', value: `${analysis.trendDelta >= 0 ? '+' : ''}${fmt(analysis.trendDelta, 2)}`, unit: 'ppm', color: trendColor },
          { label: 'STD DEV', value: fmt(analysis.stdDev, 2), unit: 'σ', color: '#00AAFF' },
        ].map(card => (
          <div key={card.label} className="stats-card" style={{ borderRight: '1px solid #111' }}>
            <div style={{
              fontFamily: 'var(--font-condensed)', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.2em', color: '#555', marginBottom: 6,
            }}>
              {card.label}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 8vw, 40px)',
              color: card.color, lineHeight: 1,
            }}>
              {card.value}
              {card.unit && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', marginLeft: 6 }}>{card.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main panels ─────────────────────────────────────────── */}
      <div className="analytics-lab-layout">

        {/* ── PPM Distribution Histogram ─────────────────────────── */}
        <section className="analytics-panel analytics-fingerprint-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="analytics-panel-title" style={{ marginBottom: 0 }}>PPM DISTRIBUTION HISTOGRAM</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, background: 'rgba(0,170,255,0.55)', border: '1px solid #00AAFF', display: 'inline-block' }} />
                <span style={{ color: '#555' }}>COMPLIANT</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, background: 'rgba(255,45,45,0.75)', border: '1px solid #FF2D2D', display: 'inline-block' }} />
                <span style={{ color: '#555' }}>VIOLATION (&gt;{PPM_VIOLATION_THRESHOLD})</span>
              </span>
            </div>
          </div>
          {loading ? (
            <div className="analytics-empty">LOADING...</div>
          ) : readings.length === 0 ? (
            <div className="analytics-empty">NO READINGS AVAILABLE</div>
          ) : (
            <>
              {/* Threshold zone label */}
              <div style={{
                marginTop: 14, marginBottom: 4, padding: '6px 12px',
                background: 'rgba(255,45,45,0.06)', borderLeft: '3px solid #FF2D2D',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: '#FF2D2D',
                letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>⚠</span>
                VIOLATION THRESHOLD: {PPM_VIOLATION_THRESHOLD} PPM — Red bars indicate readings above this limit
              </div>

              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.histogram} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                    barCategoryGap="12%">
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 0" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#444' }}
                      axisLine={{ stroke: '#2a2a2a' }} tickLine={false}
                      label={{ value: 'PPM RANGE', position: 'insideBottom', offset: -2, fill: '#333', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                    <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#444' }}
                      axisLine={{ stroke: '#2a2a2a' }} tickLine={false} width={36}
                      label={{ value: 'COUNT', angle: -90, position: 'insideLeft', offset: 10, fill: '#333', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                    <Tooltip content={<HistogramTooltip />} cursor={{ fill: 'rgba(255,214,0,0.04)' }} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={48}>
                      {analysis.histogram.map((entry, i) => (
                        <Cell key={i}
                          fill={entry.isViolation ? '#FF2D2D' : '#00AAFF'}
                          fillOpacity={entry.isViolation ? 0.75 : 0.55}
                          stroke={entry.isViolation ? '#FF2D2D' : '#00AAFF'}
                          strokeWidth={1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Percentile strip */}
              <div className="analytics-signal-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                <div>
                  <span>P50 MEDIAN</span>
                  <strong style={{ color: '#00AAFF' }}>{fmt(analysis.p50, 0)}</strong>
                </div>
                <div>
                  <span>P90</span>
                  <strong style={{ color: analysis.p90 > PPM_VIOLATION_THRESHOLD ? '#FF8C00' : '#00AAFF' }}>{fmt(analysis.p90, 0)}</strong>
                </div>
                <div>
                  <span>P99</span>
                  <strong style={{ color: analysis.p99 > PPM_VIOLATION_THRESHOLD ? '#FF2D2D' : '#FF8C00' }}>{fmt(analysis.p99, 0)}</strong>
                </div>
                <div>
                  <span>VIOLATIONS</span>
                  <strong style={{ color: analysis.violations > 0 ? '#FF2D2D' : '#00FF6A' }}>{analysis.violations}</strong>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Rolling Average Trend ──────────────────────────────── */}
        <section className="analytics-panel">
          <div className="analytics-panel-title">ROLLING AVERAGE TREND — 10-SAMPLE WINDOW</div>

          {loading ? (
            <div className="analytics-empty compact">LOADING...</div>
          ) : readings.length === 0 ? (
            <div className="analytics-empty compact">NO READINGS AVAILABLE</div>
          ) : (
            <>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analysis.trend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="ppmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00FF6A" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#00FF6A" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="violationGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF2D2D" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#FF2D2D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 0" />
                    <XAxis dataKey="time"
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#444' }}
                      axisLine={{ stroke: '#2a2a2a' }} tickLine={false} minTickGap={40} />
                    <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#444' }}
                      axisLine={{ stroke: '#2a2a2a' }} tickLine={false} width={42} />
                    <Tooltip content={<TrendTooltip />} />
                    <ReferenceLine y={PPM_VIOLATION_THRESHOLD} stroke="#FF2D2D" strokeDasharray="6 3"
                      label={{ value: 'THRESHOLD', fill: '#FF2D2D', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                    <Area type="monotone" dataKey="ppm" fill="url(#ppmAreaGrad)"
                      stroke="none" connectNulls={false} />
                    <Line type="monotone" dataKey="ppm" stroke="#00FF6A" strokeWidth={1.5}
                      dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="ma" stroke="#FFD600" strokeWidth={2.5}
                      dot={false} connectNulls={false} strokeDasharray="0" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend + stats */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12 }}>
                {[
                  { color: '#00FF6A', label: 'RAW PPM', dashed: false },
                  { color: '#FFD600', label: '10-SAMPLE SMOOTHED TREND', dashed: false },
                  { color: '#FF2D2D', label: 'THRESHOLD', dashed: true },
                ].map(({ color, label, dashed }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 20, height: dashed ? 0 : 3,
                      background: dashed ? 'none' : color,
                      borderTop: dashed ? `2px dashed ${color}` : 'none',
                      borderRadius: 2,
                    }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="analytics-signal-grid" style={{ marginTop: 14 }}>
                <div>
                  <span>MIN PPM</span>
                  <strong style={{ color: '#00FF6A' }}>{fmt(analysis.min, 0)}</strong>
                </div>
                <div>
                  <span>MAX PPM</span>
                  <strong style={{ color: analysis.max > PPM_VIOLATION_THRESHOLD ? '#FF2D2D' : '#FF8C00' }}>{fmt(analysis.max, 0)}</strong>
                </div>
                <div>
                  <span>VOLATILITY</span>
                  <strong style={{ color: analysis.volatility > 55 ? '#FF8C00' : '#00AAFF' }}>{fmt(analysis.volatility, 0)}</strong>
                </div>
                <div>
                  <span>SAMPLES</span>
                  <strong>{analysis.total}</strong>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
