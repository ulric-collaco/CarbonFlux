import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import LiveMonitor from './pages/LiveMonitor.jsx'
import BlockchainLog from './pages/BlockchainLog.jsx'
import ChainAudit from './pages/ChainAudit.jsx'
import { api } from './api.js'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [workerStatus, setWorkerStatus] = useState(null)

  // Fetch worker status for navbar badges
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await api.status()
        setWorkerStatus(s)
      } catch { /* silent — navbar degrades gracefully */ }
    }
    poll()
    const t = setInterval(poll, 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ fontFamily: 'var(--font-body)', background: '#0d0d0d', minHeight: '100vh' }}>
      <ScrollToTop />
      <Navbar workerStatus={workerStatus} />
      <Routes>
        <Route path="/"        element={<LiveMonitor />} />
        <Route path="/monitor" element={<LiveMonitor />} />
        <Route path="/chain"   element={<BlockchainLog />} />
        <Route path="/audit"   element={<ChainAudit />} />
        {/* Fallback */}
        <Route path="*" element={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 80, color: '#1a1a1a' }}>404</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', letterSpacing: '0.15em' }}>
              ROUTE NOT FOUND
            </div>
          </div>
        } />
      </Routes>
    </div>
  )
}
