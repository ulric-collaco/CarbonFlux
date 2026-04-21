import React, { useState } from 'react'
import { api } from '../api.js'

function hashShort(hash) {
  if (!hash) return '—'
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

export default function ChainAudit() {
  const [auditResult, setAuditResult] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  async function runAudit() {
    setLoading(true)
    setError(null)
    setAuditResult(null)
    try {
      const result = await api.audit()
      setAuditResult(result)
    } catch {
      setError('Audit request failed. Check CF Worker connection.')
    } finally {
      setLoading(false)
    }
  }

  const passed = auditResult?.results?.filter(r => r.valid).length ?? 0
  const failed = auditResult?.results?.filter(r => !r.valid).length ?? 0
  const chainValid = auditResult?.valid

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d' }}>

      {/* Header */}
      <div style={{
        borderBottom: '2px solid #111', padding: '16px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#fff', letterSpacing: '0.05em' }}>
            CHAIN AUDIT
          </div>
          {auditResult && (
            <div style={{
              padding: '6px 14px',
              background: chainValid ? 'rgba(0,255,106,0.12)' : 'rgba(255,45,45,0.12)',
              border: `1px solid ${chainValid ? '#00FF6A' : '#FF2D2D'}`,
              fontFamily: 'var(--font-condensed)',
              fontSize: 12, fontWeight: 900,
              color: chainValid ? '#00FF6A' : '#FF2D2D',
              letterSpacing: '0.15em',
              animation: !chainValid ? 'pulse-red 1.2s infinite' : 'none',
            }}>
              {chainValid ? '✓ CHAIN INTACT' : '✗ CHAIN COMPROMISED'}
            </div>
          )}
        </div>

        <button
          id="run-audit-btn"
          onClick={runAudit}
          disabled={loading}
          style={{
            padding: '10px 28px',
            background: loading ? 'transparent' : '#FFD600',
            border: '2px solid #FFD600',
            color: loading ? '#FFD600' : '#0d0d0d',
            fontFamily: 'var(--font-condensed)',
            fontSize: 13, fontWeight: 900,
            letterSpacing: '0.15em',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? '◌ AUDITING…' : '▶ RUN AUDIT'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '16px 24px', padding: '12px 16px',
          background: 'rgba(255,45,45,0.08)', border: '1px solid rgba(255,45,45,0.4)',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: '#FF2D2D',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Empty state */}
      {!auditResult && !loading && !error && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: 'calc(100vh - 140px)', gap: 16,
        }}>
          <div className="grid-bg" style={{
            position: 'absolute', inset: 0, zIndex: 0, opacity: 0.5,
          }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 80, color: '#1a1a1a', marginBottom: 16,
            }}>
              AUDIT
            </div>
            <div style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 13, fontWeight: 700,
              letterSpacing: '0.2em', color: '#555',
              marginBottom: 8,
            }}>
              VERIFY BLOCKCHAIN INTEGRITY ON DEMAND
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#333',
              maxWidth: 440, lineHeight: 1.8,
            }}>
              Recomputes every block hash and validates the chain linkage.
              Any tampered block will cause its hash to mismatch, flagging the compromise.
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {auditResult && (
        <div className="fade-in">
          {/* Summary stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            borderBottom: '2px solid #111',
          }}>
            {[
              { label: 'BLOCKS CHECKED', value: auditResult.chain_length, color: '#888' },
              { label: 'PASSED', value: passed, color: '#00FF6A' },
              { label: 'FAILED', value: failed, color: failed > 0 ? '#FF2D2D' : '#333' },
              { label: 'INTEGRITY', value: chainValid ? '100%' : `${Math.round((passed / (passed + failed)) * 100)}%`, color: chainValid ? '#00FF6A' : '#FF2D2D' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '20px 24px', borderRight: '1px solid #111' }}>
                <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#555', marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, color, lineHeight: 1 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Audited at */}
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #111' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444', letterSpacing: '0.1em' }}>
              AUDITED AT {new Date(auditResult.audited_at).toLocaleString()}
            </span>
          </div>

          {/* Block results table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>BLOCK #</th>
                  <th>RESULT</th>
                  <th>HASH VALID</th>
                  <th>PREV LINK</th>
                  <th>DEVICE</th>
                  <th>PPM</th>
                  <th>TIMESTAMP</th>
                  <th>BLOCK HASH</th>
                  <th>VIOLATION</th>
                </tr>
              </thead>
              <tbody>
                {auditResult.results.map((r) => (
                  <tr key={r.index}>
                    <td style={{ color: '#FFD600', fontWeight: 700 }}>{r.index}</td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-condensed)',
                        fontSize: 10, fontWeight: 900,
                        letterSpacing: '0.12em',
                        color: r.valid ? '#00FF6A' : '#FF2D2D',
                        padding: '3px 8px',
                        background: r.valid ? 'rgba(0,255,106,0.08)' : 'rgba(255,45,45,0.12)',
                        border: `1px solid ${r.valid ? 'rgba(0,255,106,0.2)' : 'rgba(255,45,45,0.4)'}`,
                      }}>
                        {r.valid ? '✓ PASS' : '✗ FAIL'}
                      </span>
                    </td>
                    <td style={{ color: r.blockHashMatch ? '#00FF6A' : '#FF2D2D' }}>
                      {r.blockHashMatch ? '✓' : '✗ MISMATCH'}
                    </td>
                    <td style={{ color: r.prevHashMatch ? '#00FF6A' : '#FF2D2D' }}>
                      {r.prevHashMatch ? '✓' : '✗ BROKEN LINK'}
                    </td>
                    <td style={{ color: '#FFD600' }}>{r.device_id}</td>
                    <td style={{ color: r.ppm_value > 1000 ? '#FF2D2D' : '#00FF6A' }}>
                      {r.ppm_value?.toFixed(2)}
                    </td>
                    <td>{new Date(r.timestamp * 1000).toLocaleString()}</td>
                    <td title={r.block_hash} style={{ color: '#444', cursor: 'help' }}>
                      {hashShort(r.block_hash)}
                    </td>
                    <td>
                      {r.violation ? (
                        <span style={{ color: '#FF2D2D', fontFamily: 'var(--font-condensed)', fontSize: 10, letterSpacing: '0.1em' }}>
                          ⚠ VIOLATION
                        </span>
                      ) : (
                        <span style={{ color: '#333' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
