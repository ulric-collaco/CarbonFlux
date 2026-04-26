import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

const FILTERS = [
  { label: 'OPEN', value: 'open' },
  { label: 'UNACK', value: 'unacknowledged' },
  { label: 'RESOLVED', value: 'resolved' },
  { label: 'ALL', value: 'all' },
]

const SEVERITY_COLOR = {
  LOW: '#00AAFF',
  MEDIUM: '#FF8C00',
  HIGH: '#FF2D2D',
  CRITICAL: '#FF2D2D',
}

function formatTs(ms) {
  if (!ms) return ' - '
  return new Date(ms).toLocaleString()
}

function shortId(id) {
  if (!id) return ' - '
  return `${id.slice(0, 14)}...${id.slice(-6)}`
}

function durationLabel(seconds) {
  const s = Number(seconds || 0)
  if (s < 60) return `${s}s`
  const minutes = Math.floor(s / 60)
  const rem = s % 60
  return `${minutes}m ${rem}s`
}

export default function IncidentCenter() {
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('open')
  const [operator, setOperator] = useState('operator-1')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async (activeFilter = filter, preserveLoading = false) => {
    if (!preserveLoading) setLoading(true)
    try {
      const [incidentData, statsData] = await Promise.all([
        api.incidents(activeFilter, 120),
        api.incidentStats(),
      ])
      setIncidents(incidentData.incidents || [])
      setStats(statsData.stats || null)
      setError(null)
    } catch {
      setError('Unable to load incident center. Check backend connection.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load(filter)
  }, [filter, load])

  useEffect(() => {
    const timer = setInterval(() => {
      load(filter, true)
    }, 5000)
    return () => clearInterval(timer)
  }, [filter, load])

  async function acknowledge(incidentId) {
    const actor = operator.trim()
    if (!actor) {
      setError('Set an operator name before acknowledging incidents.')
      return
    }

    const note = window.prompt('Acknowledge note (optional):') || ''
    setBusyId(incidentId)
    try {
      await api.acknowledgeIncident(incidentId, actor, note)
      await load(filter, true)
      setError(null)
    } catch {
      setError('Failed to acknowledge incident.')
    } finally {
      setBusyId(null)
    }
  }

  async function resolve(incidentId) {
    const actor = operator.trim()
    if (!actor) {
      setError('Set an operator name before resolving incidents.')
      return
    }

    const note = window.prompt('Resolution note (optional):') || ''
    setBusyId(incidentId)
    try {
      await api.resolveIncident(incidentId, actor, note)
      await load(filter, true)
      setError(null)
    } catch {
      setError('Failed to resolve incident.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d' }}>
      <div className="page-header" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <div className="page-header-row" style={{ gap: 16 }}>
          <div className="page-title">INCIDENT CENTER</div>
          {stats?.open_unacknowledged > 0 && (
            <div className="pulse-red" style={{
              padding: '6px 12px',
              border: '1px solid rgba(255,45,45,0.45)',
              background: 'rgba(255,45,45,0.12)',
              fontFamily: 'var(--font-condensed)',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.15em',
              color: '#FF2D2D',
            }}>
              {stats.open_unacknowledged} UNACKNOWLEDGED
            </div>
          )}
        </div>

        <div className="page-header-actions" style={{ alignItems: 'center' }}>
          <input
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
            placeholder="operator name"
            style={{
              width: 180,
              minHeight: 42,
              background: '#111',
              border: '1px solid #333',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '8px 10px',
              outline: 'none',
            }}
          />
          {FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              style={{
                minHeight: 42,
                padding: '9px 14px',
                background: filter === item.value ? '#FFD600' : 'transparent',
                border: `2px solid ${filter === item.value ? '#FFD600' : '#2a2a2a'}`,
                color: filter === item.value ? '#0d0d0d' : '#666',
                fontFamily: 'var(--font-condensed)',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="page-error-banner" style={{
          background: 'rgba(255,45,45,0.08)',
          border: '1px solid rgba(255,45,45,0.35)',
          color: '#FF2D2D',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}>
          {error}
        </div>
      )}

      <div className="incident-kpi-grid">
        {[
          { label: 'OPEN', value: stats?.open ?? '-', color: '#FFD600' },
          { label: 'UNACKNOWLEDGED', value: stats?.open_unacknowledged ?? '-', color: '#FF2D2D' },
          { label: 'CRITICAL OPEN', value: stats?.open_critical ?? '-', color: '#FF2D2D' },
          { label: 'ACTIVE DEVICES', value: stats?.active_devices ?? '-', color: '#00AAFF' },
          { label: '24H INCIDENTS', value: stats?.triggered_last_24h ?? '-', color: '#00FF6A' },
        ].map((card) => (
          <div key={card.label} className="stats-card" style={{ borderRight: '1px solid #111' }}>
            <div style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#555',
              marginBottom: 6,
            }}>
              {card.label}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px, 10vw, 38px)',
              color: card.color,
              lineHeight: 1,
            }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="incident-list-wrap">
        {loading ? (
          <div style={{
            minHeight: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.12em',
          }}>
            LOADING INCIDENTS...
          </div>
        ) : incidents.length === 0 ? (
          <div style={{
            minHeight: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333',
            fontFamily: 'var(--font-condensed)',
            fontSize: 16,
            letterSpacing: '0.15em',
            border: '1px solid #1a1a1a',
            background: '#111',
          }}>
            NO INCIDENTS FOR CURRENT FILTER
          </div>
        ) : (
          <div className="incident-card-grid">
            {incidents.map((incident) => {
              const severity = String(incident.severity || 'LOW').toUpperCase()
              const severityColor = SEVERITY_COLOR[severity] || '#00AAFF'
              const isOpen = incident.status === 'OPEN'
              const isBusy = busyId === incident.id

              return (
                <div
                  key={incident.id}
                  className="incident-card"
                  style={{
                    border: `1px solid ${isOpen ? '#2a2a2a' : '#1f1f1f'}`,
                    borderLeft: `4px solid ${severityColor}`,
                    background: 'linear-gradient(180deg, #121212 0%, #0f0f0f 100%)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: '#555',
                        letterSpacing: '0.14em',
                        marginBottom: 8,
                      }}>
                        INCIDENT ID
                      </div>
                      <div title={incident.id} style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: '#FFD600',
                      }}>
                        {shortId(incident.id)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '4px 9px',
                        border: '1px solid #333',
                        background: '#111',
                        color: '#777',
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                      }}>
                        {incident.status}
                      </span>
                      <span style={{
                        padding: '4px 9px',
                        border: `1px solid ${severityColor}`,
                        background: `${severityColor}22`,
                        color: severityColor,
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                      }}>
                        {severity}
                      </span>
                      {incident.acknowledged ? (
                        <span style={{
                          padding: '4px 9px',
                          border: '1px solid #00FF6A',
                          background: 'rgba(0,255,106,0.1)',
                          color: '#00FF6A',
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: '0.12em',
                        }}>
                          ACK
                        </span>
                      ) : (
                        <span className="pulse-red" style={{
                          padding: '4px 9px',
                          border: '1px solid #FF2D2D',
                          background: 'rgba(255,45,45,0.12)',
                          color: '#FF2D2D',
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: '0.12em',
                        }}>
                          UNACK
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="incident-detail-grid">
                    <div>
                      <div className="incident-label">DEVICE</div>
                      <div className="incident-value">{incident.device_id || ' - '}</div>
                    </div>
                    <div>
                      <div className="incident-label">LATEST / PEAK</div>
                      <div className="incident-value" style={{ color: severityColor }}>
                        {Number(incident.latest_ppm || 0).toFixed(2)} / {Number(incident.peak_ppm || 0).toFixed(2)} ppm
                      </div>
                    </div>
                    <div>
                      <div className="incident-label">THRESHOLD</div>
                      <div className="incident-value">{incident.threshold_ppm ?? '-'} ppm</div>
                    </div>
                    <div>
                      <div className="incident-label">DURATION</div>
                      <div className="incident-value">{durationLabel(incident.duration_seconds)}</div>
                    </div>
                    <div>
                      <div className="incident-label">TRIGGERED</div>
                      <div className="incident-value">{formatTs(incident.triggered_at)}</div>
                    </div>
                    <div>
                      <div className="incident-label">UPDATED</div>
                      <div className="incident-value">{formatTs(incident.updated_at)}</div>
                    </div>
                  </div>

                  {(incident.acknowledged_by || incident.resolved_by || incident.resolution_note) && (
                    <div style={{
                      marginTop: 12,
                      borderTop: '1px solid #1f1f1f',
                      paddingTop: 10,
                      color: '#666',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      lineHeight: 1.6,
                    }}>
                      {incident.acknowledged_by && <div>ACK BY: {incident.acknowledged_by} at {formatTs(incident.acknowledged_at)}</div>}
                      {incident.resolved_by && <div>RESOLVED BY: {incident.resolved_by} at {formatTs(incident.resolved_at)}</div>}
                      {incident.resolution_note && <div>NOTE: {incident.resolution_note}</div>}
                    </div>
                  )}

                  {isOpen && (
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 14,
                    }}>
                      {!incident.acknowledged && (
                        <button
                          onClick={() => acknowledge(incident.id)}
                          disabled={isBusy}
                          style={{
                            minHeight: 42,
                            padding: '9px 16px',
                            border: '2px solid #FFD600',
                            background: isBusy ? 'transparent' : '#FFD600',
                            color: isBusy ? '#FFD600' : '#0d0d0d',
                            fontFamily: 'var(--font-condensed)',
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: '0.12em',
                            cursor: isBusy ? 'wait' : 'pointer',
                          }}
                        >
                          {isBusy ? 'WORKING...' : 'ACKNOWLEDGE'}
                        </button>
                      )}

                      <button
                        onClick={() => resolve(incident.id)}
                        disabled={isBusy}
                        style={{
                          minHeight: 42,
                          padding: '9px 16px',
                          border: '2px solid #00FF6A',
                          background: 'transparent',
                          color: '#00FF6A',
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: '0.12em',
                          cursor: isBusy ? 'wait' : 'pointer',
                          opacity: isBusy ? 0.7 : 1,
                        }}
                      >
                        {isBusy ? 'WORKING...' : 'RESOLVE'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
