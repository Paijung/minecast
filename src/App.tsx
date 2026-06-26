// src/App.tsx
// MineCast Root Component

import { useEffect, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import Sidebar from './components/layout/Sidebar'
import HomePage from './components/pages/HomePage'
import MonitoringPage from './components/pages/MonitoringPage'
import HistoryPage from './components/pages/HistoryPage'
import StatisticsPage from './components/pages/StatisticsPage'
import SettingsPage from './components/pages/SettingsPage'
import ToastContainer from './components/ui/ToastContainer'
import TitleBar from './components/layout/TitleBar'
import * as api from './services/api'

export default function App() {
  const { currentPage, theme, setTheme, setEffectiveTheme, effectiveTheme, setActiveLocation, setPaths } = useAppStore()

  // Initialize app
  useEffect(() => {
    initApp()
  }, [])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  const initApp = async () => {
    try {
      // Load settings
      const settings = await api.getAllSettings()
      const themeVal = settings.find(s => s.key === 'theme')?.value || 'system'
      setTheme(themeVal as any)
      applyTheme(themeVal)

      // Load active location
      const loc = await api.getActiveLocation()
      if (loc) setActiveLocation(loc)

      // Load paths
      const paths = await api.getPaths()
      setPaths(paths)

      // Listen for system theme changes
      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        mq.addEventListener('change', () => {
          const currentTheme = useAppStore.getState().theme
          if (currentTheme === 'system') {
            applyTheme('system')
          }
        })
      }
    } catch (e) {
      console.error('App init error:', e)
    }
  }

  const applyTheme = useCallback((t: string) => {
    let effective: 'light' | 'dark' = 'dark'
    if (t === 'light') effective = 'light'
    else if (t === 'dark') effective = 'dark'
    else {
      // system
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
      effective = prefersDark ? 'dark' : 'light'
    }
    setEffectiveTheme(effective)
    document.documentElement.setAttribute('data-theme', effective)
  }, [setEffectiveTheme])

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', overflow: 'hidden' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          overflow: 'hidden',
          background: 'var(--bg-base)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'monitoring' && <MonitoringPage />}
          {currentPage === 'history' && <HistoryPage />}
          {currentPage === 'statistics' && <StatisticsPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
