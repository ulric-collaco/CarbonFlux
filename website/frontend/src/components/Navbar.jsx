import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_LINKS = [
  { label: 'LIVE MONITOR', path: '/' },
  { label: 'ANALYTICS', path: '/analytics' },
  { label: 'INCIDENT CENTER', path: '/incidents' },
  { label: 'CHAIN AUDIT', path: '/audit' },
]

export default function Navbar({ workerStatus }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const chainLen = workerStatus?.chain_length ?? '–'
  const violations = workerStatus?.violations_count ?? 0
  const unacknowledgedIncidents = workerStatus?.incidents_unacknowledged ?? 0

  return (
    <header style={{
      background: '#0d0d0d',
      borderBottom: '4px solid #FFD600',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <nav className="nav-shell" style={{ maxWidth: 1600, margin: '0 auto' }}>
        <div className="nav-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 38, height: 38,
              background: '#FFD600',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-2deg)',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#0d0d0d' }}>CF</span>
            </div>
            <div className="logo-text-mobile">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#FFD600', letterSpacing: '0.08em', display: 'block' }}>
                CARBONFLUX
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#555', letterSpacing: '0.16em' }}>
                EMISSION MONITOR
              </span>
            </div>
            <div className="logo-text" style={{ display: 'none' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#FFD600', letterSpacing: '0.1em', display: 'block' }}>
                CARBONFLUX
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555', letterSpacing: '0.2em' }}>
                EMISSION MONITOR
              </span>
            </div>
          </NavLink>

          {/* Desktop nav links */}
          <div className="nav-desktop" style={{ display: 'none', alignItems: 'center', gap: 2 }}>
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  style={({ isActive }) => ({
                    padding: '8px 14px',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    color: isActive ? '#FFD600' : '#888',
                    textDecoration: 'none',
                    borderBottom: isActive ? '2px solid #FFD600' : '2px solid transparent',
                    background: isActive ? 'rgba(255,214,0,0.07)' : 'transparent',
                    transition: 'all 0.15s',
                  })}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>

          {/* Right side — status chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Chain length */}
                <div className="status-chip" style={{
                  padding: '5px 10px',
                  background: '#111',
                  border: '1px solid #2a2a2a',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: '#555',
                  letterSpacing: '0.1em',
                }}>
                  <span style={{ color: '#FFD600' }}>{chainLen}</span> BLOCKS
                </div>

                {/* Violations */}
                {violations > 0 && (
                  <div className="status-chip pulse-red" style={{
                    padding: '5px 10px',
                    background: 'rgba(255,45,45,0.12)',
                    border: '1px solid rgba(255,45,45,0.5)',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#FF2D2D',
                    letterSpacing: '0.15em',
                  }}>
                    ⚠ {violations} VIOLATION{violations > 1 ? 'S' : ''}
                  </div>
                )}

                {unacknowledgedIncidents > 0 && (
                  <div className="status-chip pulse-red" style={{
                    padding: '5px 10px',
                    background: 'rgba(255,140,0,0.12)',
                    border: '1px solid rgba(255,140,0,0.45)',
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#FF8C00',
                    letterSpacing: '0.15em',
                  }}>
                    ! {unacknowledgedIncidents} UNACK INCIDENT{unacknowledgedIncidents > 1 ? 'S' : ''}
                  </div>
                )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="nav-mobile-toggle"
              style={{
                width: 42, height: 42,
                background: mobileOpen ? '#FFD600' : '#111',
                border: '2px solid #333',
                color: mobileOpen ? '#0d0d0d' : '#888',
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
              }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? '×' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ borderTop: '2px solid #FFD600', paddingBottom: 6 }}>
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '12px 14px',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: isActive ? '#FFD600' : '#888',
                  textDecoration: 'none',
                  borderLeft: isActive ? '4px solid #FFD600' : '4px solid transparent',
                  borderBottom: '1px solid #1a1a1a',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
