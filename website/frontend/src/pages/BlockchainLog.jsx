import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'
import { PPM_VIOLATION_THRESHOLD, POLL_INTERVAL_MS } from '../config.js'

function hashPreview(hash) {
  if (!hash) return '—'
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

export default function BlockchainLog() {
  const [blocks, setBlocks]   = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filter, setFilter]   = useState('ALL') // ALL | VIOLATION | COMPLIANT

  const load = useCallback(async () => {
    try {
      const data = await api.latest(100)
      setBlocks(data.blocks || [])
      setTotal(data.total || 0)
      setError(null)
    } catch {
      setError('Failed to load blockchain data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_INTERVAL_MS * 5) // poll every 10s
    return () => clearInterval(t)
  }, [load])

  const filtered = blocks.filter(b => {
    if (filter === 'VIOLATION') return b.violation
    if (filter === 'COMPLIANT') return !b.violation
    return true
  })

  const violationCount = blocks.filter(b => b.violation).length

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d' }}>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-row" style={{ gap: 16 }}>
          <div className="page-title">
            BLOCKCHAIN LOG
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: '#444', padding: '6px 10px', border: '1px solid #1a1a1a',
          }}>
            {total} TOTAL BLOCKS
          </div>
          {violationCount > 0 && (
            <div className="pulse-red" style={{
              padding: '5px 12px',
              background: 'rgba(255,45,45,0.12)',
              border: '1px solid rgba(255,45,45,0.4)',
              fontFamily: 'var(--font-condensed)',
              fontSize: 11, fontWeight: 900,
              color: '#FF2D2D', letterSpacing: '0.15em',
            }}>
              ⚠ {violationCount} VIOLATION{violationCount > 1 ? 'S' : ''}
            </div>
          )}
        </div>

        {/* Filter buttons */}
        <div className="page-header-actions">
          {['ALL', 'VIOLATION', 'COMPLIANT'].map(f => (
            <button
              key={f}
              id={`filter-${f.toLowerCase()}`}
              className="filter-btn"
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                background: filter === f ? (f === 'VIOLATION' ? '#FF2D2D' : f === 'COMPLIANT' ? '#00FF6A' : '#FFD600') : 'transparent',
                border: `2px solid ${filter === f ? 'transparent' : '#2a2a2a'}`,
                color: filter === f ? '#0d0d0d' : '#555',
                fontFamily: 'var(--font-condensed)',
                fontSize: 11, fontWeight: 900,
                letterSpacing: '0.12em',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="page-error-banner" style={{
          background: 'rgba(255,45,45,0.08)', border: '1px solid rgba(255,45,45,0.4)',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: '#FF2D2D',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Stats row */}
      <div className="blockchain-stats" style={{ borderBottom: '2px solid #111' }}>
        {[
          { label: 'TOTAL BLOCKS', value: total, color: '#FFD600' },
          { label: 'VIOLATIONS', value: violationCount, color: violationCount > 0 ? '#FF2D2D' : '#555' },
          { label: 'COMPLIANT', value: total - violationCount, color: '#00FF6A' },
          { label: 'SHOWING', value: filtered.length, color: '#888' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stats-card" style={{
            borderRight: '1px solid #111',
          }}>
            <div style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.2em', color: '#555', marginBottom: 6,
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 11vw, 36px)', color, lineHeight: 1,
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Block table */}
      <div className="chain-table-wrap" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 300,
            fontFamily: 'var(--font-mono)', fontSize: 12, color: '#333', letterSpacing: '0.1em',
          }}>
            LOADING CHAIN…
          </div>
        ) : (
          <table className="data-table chain-table">
            <thead>
              <tr>
                <th>#</th>
                <th>TIMESTAMP</th>
                <th>DEVICE</th>
                <th>PPM</th>
                <th>AVG PPM</th>
                <th>STATUS</th>
                <th>BLOCK HASH</th>
                <th>PREV HASH</th>
                <th>DATA HASH</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: '#333', padding: 40 }}>
                    NO BLOCKS MATCH FILTER
                  </td>
                </tr>
              ) : (
                filtered.map((block) => {
                  const isViol = block.violation
                  return (
                    <tr key={block.index} style={{
                      borderLeft: isViol ? '3px solid #FF2D2D' : undefined,
                    }}>
                      <td style={{ color: '#FFD600', fontWeight: 700 }}>{block.index}</td>
                      <td>{new Date(block.timestamp * 1000).toLocaleString()}</td>
                      <td style={{ color: '#FFD600' }}>{block.device_id}</td>
                      <td style={{ color: isViol ? '#FF2D2D' : '#00FF6A', fontWeight: 700 }}>
                        {block.ppm_value?.toFixed(2)}
                      </td>
                      <td style={{ color: '#00AAFF' }}>{block.avg_ppm?.toFixed(2)}</td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-condensed)',
                          fontSize: 9, fontWeight: 900,
                          letterSpacing: '0.1em',
                          color: isViol ? '#FF2D2D' : '#00FF6A',
                          padding: '3px 8px',
                          background: isViol ? 'rgba(255,45,45,0.1)' : 'rgba(0,255,106,0.08)',
                          border: `1px solid ${isViol ? 'rgba(255,45,45,0.4)' : 'rgba(0,255,106,0.2)'}`,
                          animation: isViol ? 'pulse-red 1.4s infinite' : 'none',
                        }}>
                          {isViol ? '⚠ VIOLATION' : '✓ COMPLIANT'}
                        </span>
                      </td>
                      <td title={block.block_hash} style={{ color: '#FFD600', cursor: 'help' }}>
                        {hashPreview(block.block_hash)}
                      </td>
                      <td title={block.previous_hash} style={{ color: '#333', cursor: 'help' }}>
                        {hashPreview(block.previous_hash)}
                      </td>
                      <td title={block.data_hash} style={{ color: '#333', cursor: 'help' }}>
                        {hashPreview(block.data_hash)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
