import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { api } from '../api.js'
import { POLL_INTERVAL_MS, PPM_VIOLATION_THRESHOLD } from '../config.js'
import { StateBadge, PpmGauge, KPICard } from '../components/Widgets.jsx'

const MAX_CHART_POINTS = 60

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#111', border: '1px solid #2a2a2a',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <div style={{ color: '#555', marginBottom: 4, letterSpacing: '0.1em' }}>
        {new Date(d.received_at).toLocaleTimeString()}
      </div>
      <div style={{ color: d.ppm_value > PPM_VIOLATION_THRESHOLD ? '#FF2D2D' : '#00FF6A', fontSize: 15 }}>
        {d.ppm_value?.toFixed(2)} ppm
      </div>
      {d.avg_ppm != null && (
        <div style={{ color: '#555', marginTop: 2 }}>avg {d.avg_ppm?.toFixed(2)} ppm</div>
      )}
    </div>
  )
}

export default function LiveMonitor() {
  const [readings, setReadings]     = useState([])
  const [status, setStatus]         = useState(null)
  const [error, setError]           = useState(null)
  const [lastPoll, setLastPoll]     = useState(null)
  const [isLive, setIsLive]         = useState(true)
  const intervalRef                 = useRef(null)

  const poll = useCallback(async () => {
    try {
      const [readData, statData] = await Promise.all([
        api.readings(MAX_CHART_POINTS),
        api.status(),
      ])
      // readings from API are newest-first; reverse for chart (oldest → newest)
      const sorted = [...(readData.readings || [])].reverse()
      setReadings(sorted)
      setStatus(statData)
      setError(null)
      setLastPoll(new Date())
    } catch (err) {
      setError('Failed to reach backend. Check your CF Worker URL.')
    }
  }, [])

  useEffect(() => {
    poll()
    if (isLive) {
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    }
    return () => clearInterval(intervalRef.current)
  }, [poll, isLive])

  const latest = readings.at(-1)
  const currentPpm = latest?.ppm_value ?? 0
  const currentAvg = latest?.avg_ppm ?? 0
  const deviceId   = latest?.device_id ?? '—'

  // Infer device state from latest reading — CF Worker doesn't track state
  // Use reading metadata as proxy
  const violationCount = readings.filter(r => r.ppm_value > PPM_VIOLATION_THRESHOLD).length

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d' }}>

      {/* Page header */}
      <div style={{
        background: '#0d0d0d',
        borderBottom: '2px solid #111',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28, color: '#fff', letterSpacing: '0.05em',
          }}>
            LIVE MONITOR
          </div>
          {latest && <StateBadge state="DETECTING" />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Device ID */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: '#444', padding: '6px 10px', border: '1px solid #1a1a1a',
          }}>
            {deviceId}
          </div>

          {/* Sample count */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: '#444', padding: '6px 10px', border: '1px solid #1a1a1a',
          }}>
            {readings.length} / {MAX_CHART_POINTS} SAMPLES
          </div>

          {/* Live toggle */}
          <button
            id="live-toggle-btn"
            onClick={() => {
              const next = !isLive
              setIsLive(next)
              if (next) intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
              else clearInterval(intervalRef.current)
            }}
            style={{
              padding: '8px 20px',
              background: isLive ? 'transparent' : '#FFD600',
              border: isLive ? '2px solid #FF2D2D' : '2px solid #FFD600',
              color: isLive ? '#FF2D2D' : '#0d0d0d',
              fontFamily: 'var(--font-condensed)',
              fontSize: 12, fontWeight: 900,
              letterSpacing: '0.15em', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {isLive ? '⏹ PAUSE' : '▶ RESUME'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '16px 24px',
          padding: '12px 16px',
          background: 'rgba(255,45,45,0.08)',
          border: '1px solid rgba(255,45,45,0.4)',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: '#FF2D2D',
          letterSpacing: '0.05em',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Main grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: 0,
        minHeight: 'calc(100vh - 140px)',
      }}>

        {/* ─── Left panel — KPIs ─── */}
        <div style={{
          borderRight: '2px solid #111',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          background: '#0d0d0d',
        }}>
          <div style={{ padding: '20px 20px 12px' }}>
            <PpmGauge ppm={currentPpm} label="CURRENT PPM" />
          </div>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <KPICard
              label="AVG PPM"
              value={currentAvg.toFixed(2)}
              unit="ppm"
              accentColor="#00AAFF"
              subLabel="Rolling average"
            />
            <KPICard
              label="READINGS STORED"
              value={status?.readings_count ?? '—'}
              accentColor="#FFD600"
              subLabel="Total validated readings"
            />
            <KPICard
              label="CHAIN BLOCKS"
              value={status?.chain_length ?? '—'}
              accentColor="#888"
              subLabel="Blockchain entries"
            />
            <KPICard
              label="VIOLATIONS"
              value={status?.violations_count ?? '—'}
              unit="events"
              accentColor={violationCount > 0 ? '#FF2D2D' : '#555'}
              subLabel={`Threshold: ${PPM_VIOLATION_THRESHOLD} ppm`}
            />
          </div>

          {/* Last poll time */}
          {lastPoll && (
            <div style={{ padding: '16px 20px', marginTop: 'auto' }}>
              <div style={{
                background: '#111', border: '1px solid #1a1a1a',
                padding: '12px 16px',
                borderTop: isLive ? '3px solid #00FF6A' : '3px solid #FF8C00',
              }}>
                <div style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.2em', color: '#555', marginBottom: 6,
                }}>
                  LAST UPDATED
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isLive ? '#00FF6A' : '#FF8C00' }}>
                  {lastPoll.toLocaleTimeString()}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#333', marginTop: 4 }}>
                  POLL EVERY {POLL_INTERVAL_MS / 1000}s
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right panel — Chart ─── */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Violation alert banner */}
          {currentPpm > PPM_VIOLATION_THRESHOLD && (
            <div className="pulse-red glow-red fade-in" style={{
              padding: '12px 20px',
              background: 'rgba(255,45,45,0.1)',
              border: '2px solid rgba(255,45,45,0.6)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20, color: '#FF2D2D', letterSpacing: '0.05em',
              }}>
                ⚠ VIOLATION ALERT
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11, color: '#FF2D2D',
              }}>
                PPM {currentPpm.toFixed(1)} EXCEEDS REGULATORY THRESHOLD OF {PPM_VIOLATION_THRESHOLD}
              </span>
            </div>
          )}

          {/* Chart */}
          <div style={{
            background: '#111',
            border: '1px solid #1a1a1a',
            padding: '20px 20px 10px',
            flex: 1, minHeight: 340,
          }}>
            <div style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.2em', color: '#555',
              marginBottom: 16,
            }}>
              PPM OVER TIME — LAST {readings.length} READINGS
            </div>

            {readings.length === 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 280,
                fontFamily: 'var(--font-mono)', fontSize: 12, color: '#333',
                letterSpacing: '0.1em', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: 28 }}>◌</div>
                <div>NO DATA — AWAITING READINGS</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={readings} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 0" />
                  <XAxis
                    dataKey="received_at"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#444' }}
                    axisLine={{ stroke: '#2a2a2a' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#444' }}
                    axisLine={{ stroke: '#2a2a2a' }}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={PPM_VIOLATION_THRESHOLD}
                    stroke="#FF2D2D"
                    strokeDasharray="6 3"
                    label={{ value: 'THRESHOLD', fill: '#FF2D2D', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ppm_value"
                    stroke="#00FF6A"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#00FF6A', stroke: '#0d0d0d', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_ppm"
                    stroke="#FFD600"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              {[
                { color: '#00FF6A', label: 'PPM VALUE', dashed: false },
                { color: '#FFD600', label: 'AVG PPM', dashed: true },
                { color: '#FF2D2D', label: 'THRESHOLD', dashed: true },
              ].map(({ color, label, dashed }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 20, height: 2,
                    background: dashed ? 'none' : color,
                    borderTop: dashed ? `2px dashed ${color}` : 'none',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent readings mini-table */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', overflow: 'auto', maxHeight: 240 }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '2px solid #1a1a1a',
              fontFamily: 'var(--font-condensed)',
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.2em', color: '#555',
            }}>
              RECENT READINGS
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>DEVICE</th>
                  <th>PPM</th>
                  <th>AVG PPM</th>
                  <th>NONCE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#333', padding: 24 }}>NO READINGS YET</td></tr>
                ) : (
                  [...readings].reverse().slice(0, 20).map((r, i) => {
                    const isViol = r.ppm_value > PPM_VIOLATION_THRESHOLD
                    return (
                      <tr key={i}>
                        <td>{new Date(r.received_at).toLocaleTimeString()}</td>
                        <td style={{ color: '#FFD600' }}>{r.device_id}</td>
                        <td style={{ color: isViol ? '#FF2D2D' : '#00FF6A' }}>
                          {r.ppm_value?.toFixed(2)}
                        </td>
                        <td style={{ color: '#00AAFF' }}>{r.avg_ppm?.toFixed(2)}</td>
                        <td style={{ color: '#444' }}>{r.nonce}</td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-condensed)',
                            fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.1em',
                            color: isViol ? '#FF2D2D' : '#00FF6A',
                            padding: '2px 6px',
                            background: isViol ? 'rgba(255,45,45,0.1)' : 'rgba(0,255,106,0.08)',
                            border: `1px solid ${isViol ? 'rgba(255,45,45,0.3)' : 'rgba(0,255,106,0.2)'}`,
                          }}>
                            {isViol ? 'VIOLATION' : 'COMPLIANT'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .monitor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
