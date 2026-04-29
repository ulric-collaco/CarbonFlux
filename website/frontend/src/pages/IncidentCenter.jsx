import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (preserveLoading = false) => {
    if (!preserveLoading) setLoading(true)
    try {
      const incidentData = await api.incidents('all', 120)
      setIncidents(incidentData.incidents || [])
      setError(null)
    } catch {
      setError('Unable to load incident center. Check backend connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => {
      load(true)
    }, 5000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d' }}>
      <div className="page-header" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <div className="page-header-row" style={{ gap: 16 }}>
          <div className="page-title">INCIDENT FEED</div>
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
            NO INCIDENTS RECORDED
          </div>
        ) : (
          <div className="incident-card-grid">
            {incidents.map((incident) => {
              const severity = String(incident.severity || 'LOW').toUpperCase()
              const severityColor = SEVERITY_COLOR[severity] || '#00AAFF'

              return (
                <div
                  key={incident.id}
                  className="incident-card"
                  style={{
                    border: '1px solid #1f1f1f',
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

                  {(incident.resolution_note || incident.notes?.length > 0) && (
                    <div style={{
                      marginTop: 12,
                      borderTop: '1px solid #1f1f1f',
                      paddingTop: 10,
                      color: '#666',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      lineHeight: 1.6,
                    }}>
                      {incident.resolution_note && <div>NOTE: {incident.resolution_note}</div>}
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
