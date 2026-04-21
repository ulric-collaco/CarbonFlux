import React from 'react'
import { PPM_VIOLATION_THRESHOLD } from '../config.js'

const STATE_CONFIG = {
  STANDBY:   { color: '#555555', label: 'STANDBY',   pulse: false },
  WARMUP:    { color: '#FFD600', label: 'WARMING UP', pulse: true  },
  READY:     { color: '#00AAFF', label: 'READY',      pulse: false },
  DETECTING: { color: '#00FF6A', label: 'DETECTING',  pulse: true  },
  STOPPED:   { color: '#FF8C00', label: 'STOPPED',    pulse: false },
  UNKNOWN:   { color: '#333333', label: 'UNKNOWN',    pulse: false },
}

export function StateBadge({ state = 'UNKNOWN', large = false }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.UNKNOWN
  const sz = large ? 10 : 7
  const fs = large ? 13 : 10

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: large ? '7px 14px' : '5px 10px',
      background: `${cfg.color}18`,
      border: `1px solid ${cfg.color}`,
      fontFamily: 'var(--font-mono)',
      fontSize: fs,
      color: cfg.color,
      letterSpacing: '0.12em',
    }}>
      <span style={{
        width: sz, height: sz,
        borderRadius: '50%',
        background: cfg.color,
        display: 'inline-block',
        animation: cfg.pulse ? (state === 'WARMUP' ? 'pulse-yellow 1.8s infinite' : 'pulse-green 2s infinite') : 'none',
      }} />
      {cfg.label}
    </div>
  )
}

export function PpmGauge({ ppm = 0, label = 'PPM VALUE' }) {
  const isViolation = ppm > PPM_VIOLATION_THRESHOLD
  const isWarn = ppm > PPM_VIOLATION_THRESHOLD * 0.7
  const color = isViolation ? '#FF2D2D' : isWarn ? '#FF8C00' : '#00FF6A'

  return (
    <div style={{
      background: '#111',
      border: `2px solid ${color}30`,
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Critical overlay pulse */}
      {isViolation && (
        <div className="pulse-red" style={{
          position: 'absolute', inset: 0,
          background: 'rgba(255,45,45,0.04)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{
        fontFamily: 'var(--font-condensed)',
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.25em',
        color: '#555',
        marginBottom: 4,
      }}>
        {label}
      </div>

      <div className="tick-in" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 88,
        color,
        lineHeight: 1,
        letterSpacing: '0.01em',
      }}>
        {ppm.toFixed(1)}
        <span style={{ fontSize: 22, color: '#444', marginLeft: 6 }}>ppm</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#1a1a1a', marginTop: 16 }}>
        <div style={{
          height: '100%',
          width: `${Math.min((ppm / (PPM_VIOLATION_THRESHOLD * 1.5)) * 100, 100)}%`,
          background: color,
          transition: 'width 0.4s ease, background 0.4s',
        }} />
      </div>

      {/* Threshold marker */}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <div style={{
          position: 'absolute',
          left: `${(PPM_VIOLATION_THRESHOLD / (PPM_VIOLATION_THRESHOLD * 1.5)) * 100}%`,
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: '#FF2D2D',
          letterSpacing: '0.1em',
        }}>
          ▲ {PPM_VIOLATION_THRESHOLD}
        </div>
      </div>

      {isViolation && (
        <div className="pulse-red" style={{
          marginTop: 24,
          padding: '8px 12px',
          background: 'rgba(255,45,45,0.12)',
          border: '1px solid rgba(255,45,45,0.5)',
          fontFamily: 'var(--font-condensed)',
          fontSize: 11, fontWeight: 900,
          color: '#FF2D2D',
          letterSpacing: '0.2em',
          textAlign: 'center',
        }}>
          ⚠ VIOLATION — EXCEEDS THRESHOLD
        </div>
      )}
    </div>
  )
}

export function KPICard({ label, value, unit, subLabel, accentColor = '#FFD600' }) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #1a1a1a',
      borderLeft: `3px solid ${accentColor}`,
      padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--font-condensed)',
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.2em',
        color: '#555',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 22,
        color: accentColor,
        letterSpacing: '0.02em',
      }}>
        {value}
        {unit && <span style={{ fontSize: 12, color: '#555', marginLeft: 6 }}>{unit}</span>}
      </div>
      {subLabel && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9, color: '#444',
          marginTop: 4, letterSpacing: '0.08em',
        }}>
          {subLabel}
        </div>
      )}
    </div>
  )
}
