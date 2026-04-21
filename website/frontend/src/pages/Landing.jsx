import React from 'react'
import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '◈',
    title: 'CRYPTOGRAPHIC INTEGRITY',
    desc: 'Every reading is SHA-256 hashed and HMAC-signed. Tamper a byte — the hash breaks.',
    color: '#FFD600',
  },
  {
    icon: '⛓',
    title: 'BLOCKCHAIN ANCHORING',
    desc: 'Each validated reading becomes a block linked to all previous blocks. History is immutable.',
    color: '#00FF6A',
  },
  {
    icon: '⚡',
    title: 'REAL-TIME MONITORING',
    desc: 'Live PPM readings from MQ-135 sensor streamed every 2 seconds via the mobile relay.',
    color: '#00AAFF',
  },
  {
    icon: '⚠',
    title: 'VIOLATION DETECTION',
    desc: 'Automatic flagging when gas concentration exceeds 1000 ppm regulatory threshold.',
    color: '#FF2D2D',
  },
  {
    icon: '🔁',
    title: 'REPLAY PROTECTION',
    desc: 'Nonce + timestamp window prevents replay attacks. Every packet is unique.',
    color: '#FF8C00',
  },
  {
    icon: '✓',
    title: 'ON-DEMAND AUDIT',
    desc: 'Anyone can verify the full chain at any time. Compromised blocks are instantly flagged.',
    color: '#888',
  },
]

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', overflow: 'hidden' }}>

      {/* Grid background */}
      <div className="grid-bg" style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      }} />

      {/* Scanline decoration */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '2px', background: 'rgba(255,214,0,0.15)',
        animation: 'scanline 8s linear infinite',
        zIndex: 0, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Nav */}
        <nav style={{
          padding: '0 40px',
          borderBottom: '4px solid #FFD600',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 64,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44,
              background: '#FFD600',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-2deg)',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#0d0d0d' }}>CF</span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#FFD600', letterSpacing: '0.1em' }}>
                CARBONFLUX
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555', letterSpacing: '0.2em' }}>
                TRUSTLESS EMISSION MONITOR
              </div>
            </div>
          </div>
          <Link
            to="/monitor"
            style={{
              padding: '10px 24px',
              background: '#FFD600',
              border: '2px solid #FFD600',
              color: '#0d0d0d',
              fontFamily: 'var(--font-condensed)',
              fontSize: 12, fontWeight: 900,
              letterSpacing: '0.15em',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
          >
            OPEN DASHBOARD →
          </Link>
        </nav>

        {/* Hero */}
        <div style={{
          padding: '100px 40px 80px',
          maxWidth: 900, margin: '0 auto',
        }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            marginBottom: 32,
          }}>
            <div style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: '#00FF6A',
              animation: 'pulse-green 2s infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-condensed)',
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.25em', color: '#555',
            }}>
              PHASE 1 — LIVE SYSTEM
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(56px, 12vw, 120px)',
            color: '#fff',
            lineHeight: 0.9,
            letterSpacing: '0.02em',
            marginBottom: 32,
          }}>
            <span style={{ display: 'block' }}>CARBON</span>
            <span style={{ display: 'block', color: '#FFD600' }}>FLUX</span>
          </h1>

          {/* Description */}
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 18, color: '#888',
            maxWidth: 580, lineHeight: 1.7,
            marginBottom: 48,
          }}>
            Trustless industrial emission tracking. Every gas reading is cryptographically
            hashed, signed, and anchored to an immutable blockchain — eliminating
            self-reported greenwashing.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/monitor" style={{
              padding: '14px 32px',
              background: '#FFD600',
              border: '2px solid #FFD600',
              color: '#0d0d0d',
              fontFamily: 'var(--font-condensed)',
              fontSize: 14, fontWeight: 900,
              letterSpacing: '0.15em', textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              ▶ LIVE MONITOR
            </Link>
            <Link to="/chain" style={{
              padding: '14px 32px',
              background: 'transparent',
              border: '2px solid #2a2a2a',
              color: '#888',
              fontFamily: 'var(--font-condensed)',
              fontSize: 14, fontWeight: 700,
              letterSpacing: '0.15em', textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              ⛓ BLOCKCHAIN LOG
            </Link>
            <Link to="/audit" style={{
              padding: '14px 32px',
              background: 'transparent',
              border: '2px solid #2a2a2a',
              color: '#888',
              fontFamily: 'var(--font-condensed)',
              fontSize: 14, fontWeight: 700,
              letterSpacing: '0.15em', textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              ✓ CHAIN AUDIT
            </Link>
          </div>
        </div>

        {/* Divider with hazard stripe */}
        <div style={{ margin: '0 40px', height: 6 }} className="hazard-subtle" />

        {/* Features grid */}
        <div style={{ padding: '60px 40px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.3em', color: '#555',
            marginBottom: 40,
          }}>
            SYSTEM CAPABILITIES
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 2,
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                padding: '24px',
                background: '#111',
                border: '1px solid #1a1a1a',
                borderTop: `3px solid ${f.color}`,
                transition: 'border-color 0.2s',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32, color: f.color,
                  marginBottom: 12,
                }}>
                  {f.icon}
                </div>
                <div style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.15em', color: '#fff',
                  marginBottom: 8,
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13, color: '#888', lineHeight: 1.6,
                }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline diagram */}
        <div style={{ padding: '0 40px 80px', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.3em', color: '#555',
            marginBottom: 24,
          }}>
            DATA PIPELINE
          </div>
          <div style={{
            display: 'flex', alignItems: 'center',
            flexWrap: 'wrap', gap: 2,
          }}>
            {[
              { label: 'ESP32', sub: 'MQ-135 sensor', color: '#FFD600' },
              { label: '→', color: '#333', sub: '' },
              { label: 'FLUTTER APP', sub: 'BLE bridge', color: '#00AAFF' },
              { label: '→', color: '#333', sub: '' },
              { label: 'CF WORKER', sub: 'validate + sign', color: '#FF8C00' },
              { label: '→', color: '#333', sub: '' },
              { label: 'BLOCKCHAIN', sub: 'KV storage', color: '#00FF6A' },
              { label: '→', color: '#333', sub: '' },
              { label: 'DASHBOARD', sub: 'this UI', color: '#FFD600' },
            ].map((node, i) => (
              node.label === '→' ? (
                <div key={i} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 20, color: '#2a2a2a',
                  padding: '0 8px',
                }}>→</div>
              ) : (
                <div key={i} style={{
                  padding: '14px 20px',
                  background: '#111',
                  border: `1px solid ${node.color}30`,
                  borderTop: `3px solid ${node.color}`,
                  minWidth: 120,
                }}>
                  <div style={{
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em', color: node.color,
                  }}>
                    {node.label}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9, color: '#444', marginTop: 4,
                  }}>
                    {node.sub}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '2px solid #111',
          padding: '20px 40px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#333', letterSpacing: '0.1em' }}>
            CARBONFLUX · TRUSTLESS EMISSION MONITORING
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#222', letterSpacing: '0.1em' }}>
            PHASE 1 — ESP32 + BLE + CF WORKER
          </span>
        </div>
      </div>
    </div>
  )
}
