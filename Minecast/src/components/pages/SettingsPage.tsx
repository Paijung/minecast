// src/components/pages/SettingsPage.tsx

import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { LocationResult, Theme } from '../../types'
import * as api from '../../services/api'
import {
  Search, MapPin, Check, Sun, Moon, Monitor,
  Database, Download, FolderOpen, FileText, AlertTriangle,
  Trash2, RefreshCw, Info, Clock, Shield, BookOpen
} from 'lucide-react'
import styles from './SettingsPage.module.css'

const RETENTION_OPTIONS = [
  { value: '3', label: '3 Hari' },
  { value: '7', label: '7 Hari' },
  { value: '30', label: '30 Hari' },
  { value: '-1', label: 'Jangan Hapus Otomatis' },
]

export default function SettingsPage() {
  const { activeLocation, setActiveLocation, theme, setTheme, setEffectiveTheme, addToast, paths } = useAppStore()

  // Location
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<LocationResult[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [searchDebounce, setSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Settings
  const [logRetention, setLogRetention] = useState('7')
  const [autoRefresh, setAutoRefresh] = useState('true')
  const [appVersion, setAppVersion] = useState('')

  // Database
  const [resetting, setResetting] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(0) // 0=none, 1=first, 2=second
  const [backing, setBacking] = useState(false)

  // Active section
  const [section, setSection] = useState<'location'|'appearance'|'database'|'logs'|'about'>('location')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [retention, auto, ver] = await Promise.all([
        api.getSetting('log_retention_days'),
        api.getSetting('auto_refresh'),
        api.getAppVersion(),
      ])
      if (retention) setLogRetention(retention)
      if (auto) setAutoRefresh(auto)
      setAppVersion(ver)
    } catch {}
  }

  const handleLocationSearch = (q: string) => {
    setLocationQuery(q)
    setLocationError('')
    if (searchDebounce) clearTimeout(searchDebounce)
    if (!q.trim() || q.length < 2) { setLocationResults([]); return }
    const t = setTimeout(async () => {
      setLocationLoading(true)
      try {
        const results = await api.searchLocation(q)
        if (results.length === 0) setLocationError('Lokasi tidak ditemukan. Coba nama kota/kabupaten lain.')
        setLocationResults(results)
      } catch {
        setLocationError('Gagal mencari lokasi. Periksa koneksi internet.')
        setLocationResults([])
      } finally {
        setLocationLoading(false)
      }
    }, 500)
    setSearchDebounce(t)
  }

  const handleSelectLocation = async (loc: LocationResult) => {
    try {
      const id = await api.saveLocation({
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        region: loc.region,
        province: loc.province,
        country: loc.country,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      const saved = { ...loc, id, is_active: true, created_at: new Date().toISOString() }
      setActiveLocation(saved as any)
      setLocationResults([])
      setLocationQuery('')
      addToast({ type: 'success', message: `Lokasi diatur: ${loc.name}` })
    } catch {
      addToast({ type: 'error', message: 'Gagal menyimpan lokasi' })
    }
  }

  const handleThemeChange = async (t: Theme) => {
    setTheme(t)
    await api.setSetting('theme', t)
    let effective: 'light' | 'dark' = 'dark'
    if (t === 'light') effective = 'light'
    else if (t === 'dark') effective = 'dark'
    else effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    setEffectiveTheme(effective)
    document.documentElement.setAttribute('data-theme', effective)
  }

  const handleBackup = async () => {
    setBacking(true)
    try {
      const path = await api.backupDatabase()
      addToast({ type: 'success', message: `Backup berhasil: ${path.split('\\').pop()}` })
    } catch (e: any) {
      addToast({ type: 'error', message: 'Gagal membuat backup' })
    } finally {
      setBacking(false)
    }
  }

  const handleResetStep1 = () => setResetConfirm(1)
  const handleResetStep2 = () => setResetConfirm(2)
  const handleResetCancel = () => setResetConfirm(0)

  const handleResetConfirm = async () => {
    setResetting(true)
    try {
      await api.resetDatabase()
      setActiveLocation(null)
      setResetConfirm(0)
      addToast({ type: 'success', message: 'Database berhasil direset. Backup otomatis dibuat.' })
    } catch {
      addToast({ type: 'error', message: 'Gagal mereset database' })
    } finally {
      setResetting(false)
    }
  }

  const handleSaveLogRetention = async () => {
    await api.setSetting('log_retention_days', logRetention)
    addToast({ type: 'success', message: 'Pengaturan log disimpan' })
  }

  const SECTIONS = [
    { id: 'location', label: 'Lokasi', icon: <MapPin size={15} /> },
    { id: 'appearance', label: 'Tampilan', icon: <Sun size={15} /> },
    { id: 'database', label: 'Database & Backup', icon: <Database size={15} /> },
    { id: 'logs', label: 'Log Aktivitas', icon: <FileText size={15} /> },
    { id: 'about', label: 'Tentang', icon: <Info size={15} /> },
  ] as const

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Pengaturan</h1>
      </div>

      <div className={styles.layout}>
        {/* Section Nav */}
        <nav className={styles.sectionNav}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`${styles.sectionBtn} ${section === s.id ? styles.sectionBtnActive : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>

          {/* ---- LOKASI ---- */}
          {section === 'location' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <MapPin size={18} />
                <h2>Lokasi Pertambangan</h2>
              </div>

              {activeLocation && (
                <div className={styles.activeLocationCard}>
                  <div className={styles.alcIcon}><MapPin size={16} /></div>
                  <div className={styles.alcInfo}>
                    <div className={styles.alcName}>{activeLocation.name}</div>
                    <div className={styles.alcDetail}>
                      {activeLocation.province && `${activeLocation.province}, `}{activeLocation.country}
                      {' · '}
                      <span className={styles.alcCoord}>{activeLocation.lat.toFixed(4)}, {activeLocation.lon.toFixed(4)}</span>
                    </div>
                  </div>
                  <span className={styles.alcBadge}><Check size={12} /> Aktif</span>
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Cari Lokasi Baru</label>
                <div className={styles.searchBox}>
                  <Search size={15} className={styles.searchIcon} />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Contoh: Kutai Kartanegara, Samarinda, Berau..."
                    value={locationQuery}
                    onChange={e => handleLocationSearch(e.target.value)}
                  />
                  {locationLoading && (
                    <div className={styles.searchSpinner} />
                  )}
                </div>
                <p className={styles.fieldHint}>Minimal 2 karakter untuk memulai pencarian. Lokasi divalidasi secara online.</p>
              </div>

              {locationError && (
                <div className={styles.searchError}>
                  <AlertTriangle size={14} />
                  {locationError}
                </div>
              )}

              {locationResults.length > 0 && (
                <div className={styles.resultsList}>
                  {locationResults.map((loc, i) => (
                    <button
                      key={i}
                      className={styles.resultItem}
                      onClick={() => handleSelectLocation(loc)}
                    >
                      <MapPin size={14} className={styles.resultIcon} />
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{loc.name}</span>
                        <span className={styles.resultDetail}>{loc.display_name}</span>
                      </div>
                      <span className={styles.resultCoord}>{loc.lat.toFixed(3)}, {loc.lon.toFixed(3)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- TAMPILAN ---- */}
          {section === 'appearance' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Sun size={18} />
                <h2>Tampilan & Tema</h2>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Mode Tema</label>
                <div className={styles.themeGrid}>
                  <ThemeCard
                    active={theme === 'light'}
                    onClick={() => handleThemeChange('light')}
                    icon={<Sun size={22} />}
                    label="Light Mode"
                    preview="bg-white"
                  />
                  <ThemeCard
                    active={theme === 'dark'}
                    onClick={() => handleThemeChange('dark')}
                    icon={<Moon size={22} />}
                    label="Dark Mode"
                    preview="bg-dark"
                  />
                  <ThemeCard
                    active={theme === 'system'}
                    onClick={() => handleThemeChange('system')}
                    icon={<Monitor size={22} />}
                    label="Ikuti Windows"
                    preview="bg-auto"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---- DATABASE & BACKUP ---- */}
          {section === 'database' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Database size={18} />
                <h2>Database & Backup</h2>
              </div>

              {/* Folder Shortcuts */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Folder Aplikasi</label>
                <div className={styles.folderButtons}>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFolder(paths.app_dir)}>
                    <FolderOpen size={13} /> Folder Aplikasi
                  </button>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFolder(paths.backup_dir)}>
                    <FolderOpen size={13} /> Folder Backup
                  </button>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFolder(paths.export_dir)}>
                    <FolderOpen size={13} /> Folder Export
                  </button>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFolder(paths.log_dir)}>
                    <FolderOpen size={13} /> Folder Log
                  </button>
                </div>
                <div className={styles.folderButtons} style={{ marginTop: 8 }}>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFile(`${paths.app_dir}\\README.txt`)}>
                    <BookOpen size={13} /> Buka README
                  </button>
                </div>
              </div>

              {/* Backup */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Backup Database</label>
                <p className={styles.fieldHint}>Backup otomatis dibuat setiap kali Reset Database. Backup manual dapat dilakukan kapan saja.</p>
                <button
                  className='btn btn-accent'
                  onClick={handleBackup}
                  disabled={backing}
                  style={{ width: 'fit-content' }}
                >
                  <Download size={14} />
                  {backing ? 'Membuat Backup...' : 'Backup Sekarang'}
                </button>
              </div>

              <hr className={styles.divider} />

              {/* Reset Database */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} style={{ color: '#ef4444' }}>
                  <AlertTriangle size={14} /> Reset Database
                </label>
                <p className={styles.fieldHint}>
                  Menghapus semua data forecast, aktual, histori, dan lokasi. <strong>Data tidak dapat dipulihkan kecuali dari backup.</strong> Backup otomatis dibuat sebelum reset.
                </p>

                {resetConfirm === 0 && (
                  <button className='btn btn-danger' onClick={handleResetStep1} style={{ width: 'fit-content' }}>
                    <Trash2 size={14} /> Reset Database
                  </button>
                )}

                {resetConfirm === 1 && (
                  <div className={styles.confirmBox}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div className={styles.confirmText}>
                      <strong>Apakah Anda yakin?</strong>
                      <span>Semua data akan dihapus permanen. Backup akan dibuat otomatis.</span>
                    </div>
                    <div className={styles.confirmButtons}>
                      <button className='btn btn-ghost btn-sm' onClick={handleResetCancel}>Batal</button>
                      <button className='btn btn-danger btn-sm' onClick={handleResetStep2}>Ya, Lanjutkan</button>
                    </div>
                  </div>
                )}

                {resetConfirm === 2 && (
                  <div className={styles.confirmBox} style={{ borderColor: '#dc2626' }}>
                    <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div className={styles.confirmText}>
                      <strong style={{ color: '#dc2626' }}>KONFIRMASI TERAKHIR</strong>
                      <span>Ketuk "Hapus Semua Data" untuk melanjutkan. Tindakan ini tidak dapat dibatalkan.</span>
                    </div>
                    <div className={styles.confirmButtons}>
                      <button className='btn btn-ghost btn-sm' onClick={handleResetCancel}>Batal</button>
                      <button className='btn btn-danger btn-sm' onClick={handleResetConfirm} disabled={resetting}>
                        {resetting ? 'Mereset...' : '⚠ Hapus Semua Data'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- LOG ---- */}
          {section === 'logs' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <FileText size={18} />
                <h2>Log Aktivitas</h2>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Retensi Log</label>
                <p className={styles.fieldHint}>Log lama akan otomatis dihapus saat aplikasi dibuka.</p>
                <div className={styles.retentionOptions}>
                  {RETENTION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`${styles.retentionBtn} ${logRetention === opt.value ? styles.retentionBtnActive : ''}`}
                      onClick={() => setLogRetention(opt.value)}
                    >
                      <Clock size={12} />
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button className='btn btn-accent btn-sm' onClick={handleSaveLogRetention} style={{ width: 'fit-content', marginTop: 10 }}>
                  <Check size={13} /> Simpan Pengaturan
                </button>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Akses Log</label>
                <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFolder(paths.log_dir)} style={{ width: 'fit-content' }}>
                  <FolderOpen size={13} /> Buka Folder Log
                </button>
              </div>
            </div>
          )}

          {/* ---- TENTANG ---- */}
          {section === 'about' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Info size={18} />
                <h2>Tentang MineCast</h2>
              </div>

              <div className={styles.aboutCard}>
                <div className={styles.aboutLogo}>⛏️</div>
                <div className={styles.aboutInfo}>
                  <div className={styles.aboutName}>MineCast</div>
                  <div className={styles.aboutVer}>Versi {appVersion || '1.0.0'}</div>
                  <div className={styles.aboutDesc}>
                    Sistem Monitoring Cuaca Operasional Pertambangan Batu Bara
                  </div>
                </div>
              </div>

              <div className={styles.aboutGrid}>
                <div className={styles.aboutItem}>
                  <span className={styles.aboutItemLabel}>Framework</span>
                  <span className={styles.aboutItemVal}>Tauri + React + TypeScript</span>
                </div>
                <div className={styles.aboutItem}>
                  <span className={styles.aboutItemLabel}>Database</span>
                  <span className={styles.aboutItemVal}>SQLite (Bundled)</span>
                </div>
                <div className={styles.aboutItem}>
                  <span className={styles.aboutItemLabel}>Sumber Data Utama</span>
                  <span className={styles.aboutItemVal}>BMKG (api.bmkg.go.id)</span>
                </div>
                <div className={styles.aboutItem}>
                  <span className={styles.aboutItemLabel}>Sumber Data Fallback</span>
                  <span className={styles.aboutItemVal}>Open-Meteo (open-meteo.com)</span>
                </div>
                <div className={styles.aboutItem}>
                  <span className={styles.aboutItemLabel}>Geocoding</span>
                  <span className={styles.aboutItemVal}>Open-Meteo Geocoding API</span>
                </div>
                <div className={styles.aboutItem}>
                  <span className={styles.aboutItemLabel}>Platform</span>
                  <span className={styles.aboutItemVal}>Windows 10 / 11</span>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Dokumentasi</label>
                <div className={styles.folderButtons}>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFile(`${paths.app_dir}\\README.txt`)}>
                    <BookOpen size={13} /> README.txt
                  </button>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFile(`${paths.app_dir}\\CHANGELOG.txt`)}>
                    <FileText size={13} /> CHANGELOG.txt
                  </button>
                  <button className='btn btn-secondary btn-sm' onClick={() => paths && api.openFile(`${paths.app_dir}\\TROUBLESHOOTING.txt`)}>
                    <Shield size={13} /> TROUBLESHOOTING.txt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ active, onClick, icon, label, preview }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; preview: string
}) {
  return (
    <button
      className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
      onClick={onClick}
    >
      <div className={`${styles.themePreview} ${styles[preview]}`}>
        <div className={styles.previewSidebar} />
        <div className={styles.previewContent}>
          <div className={styles.previewBar} />
          <div className={styles.previewLine} />
        </div>
      </div>
      <div className={styles.themeInfo}>
        {icon}
        <span>{label}</span>
      </div>
      {active && <Check size={14} className={styles.themeCheck} />}
    </button>
  )
}
