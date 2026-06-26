// src/components/pages/MonitoringPage.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { ForecastHour, ActualRecord, STATUS_CONFIG, getWeatherIcon } from '../../types'
import * as api from '../../services/api'
import { format, parseISO, addHours, startOfHour } from 'date-fns'
import { id } from 'date-fns/locale'
import { RefreshCw, MapPin, Clock, AlertTriangle, CloudRain, Sun, Thermometer, Wind, Eye, Droplets, Gauge } from 'lucide-react'
import WeatherChart from '../charts/WeatherChart'
import styles from './MonitoringPage.module.css'

export default function MonitoringPage() {
  const {
    activeLocation, forecastData, setForecastData,
    lastRefreshed, setLastRefreshed, isLoading, setIsLoading,
    loadError, setLoadError, actuals, setActual, loadActuals,
    addToast, setCurrentPage,
  } = useAppStore()

  const [selectedHour, setSelectedHour] = useState<ForecastHour | null>(null)
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [countdown, setCountdown] = useState('')
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table')

  const today = format(new Date(), 'yyyy-MM-dd')

  // --- Load data ---
  const loadData = useCallback(async (showToast = false) => {
    if (!activeLocation?.id) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await api.fetchWeather(activeLocation.lat, activeLocation.lon, activeLocation.id)
      setForecastData(data)
      setLastRefreshed(new Date())

      // Load actuals for today
      const actualRecords = await api.getActualsDate(activeLocation.id, today)
      loadActuals(actualRecords)

      // Auto-select current hour
      const currentHour = new Date().getHours()
      const current = data.find(d => d.date === today && d.hour === currentHour)
      if (current) setSelectedHour(current)
      else if (data.length > 0) setSelectedHour(data[0])

      if (showToast) addToast({ type: 'success', message: 'Data cuaca diperbarui' })
    } catch (e: any) {
      const msg = e?.toString() || 'Gagal memuat data cuaca'
      setLoadError(msg)
      addToast({ type: 'error', message: msg })
    } finally {
      setIsLoading(false)
    }
  }, [activeLocation, today])

  // --- Auto refresh at top of hour ---
  const scheduleNextRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setMinutes(0, 0, 0)
    nextHour.setHours(nextHour.getHours() + 1)
    setNextRefresh(nextHour)

    const msUntilNextHour = nextHour.getTime() - now.getTime()
    refreshTimerRef.current = setTimeout(() => {
      loadData(false)
      scheduleNextRefresh()
    }, msUntilNextHour)

    // Countdown display
    countdownRef.current = setInterval(() => {
      const remaining = nextHour.getTime() - Date.now()
      if (remaining <= 0) {
        setCountdown('00:00')
        return
      }
      const m = Math.floor(remaining / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }, 1000)
  }, [loadData])

  useEffect(() => {
    if (activeLocation) {
      loadData()
      scheduleNextRefresh()
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [activeLocation])

  // --- Save actual ---
  const handleActualToggle = async (hour: number, isRaining: boolean) => {
    if (!activeLocation?.id) return
    const actual: ActualRecord = {
      location_id: activeLocation.id,
      record_date: today,
      record_hour: hour,
      is_raining: isRaining,
      created_at: new Date().toISOString(),
    }
    try {
      await api.saveActual(actual)
      setActual(hour, isRaining)
    } catch (e) {
      addToast({ type: 'error', message: 'Gagal menyimpan data aktual' })
    }
  }

  // Filter: today's forecast hours (next 24h)
  const now = new Date()
  const currentHour = now.getHours()
  const todayForecasts = forecastData.filter(d => d.date === today)
  const tomorrowForecasts = forecastData.filter(d => {
    const tomorrow = format(addHours(now, 24), 'yyyy-MM-dd')
    return d.date === tomorrow
  })
  const displayForecasts = [...todayForecasts, ...tomorrowForecasts].slice(0, 24)

  // No location
  if (!activeLocation) {
    return (
      <div className={styles.noLocation}>
        <MapPin size={48} />
        <h2>Lokasi belum diatur</h2>
        <p>Atur lokasi pertambangan Anda di halaman Pengaturan untuk mulai monitoring cuaca.</p>
        <button className='btn btn-accent' onClick={() => setCurrentPage('settings')}>
          Atur Lokasi
        </button>
      </div>
    )
  }

  const overallStatus = selectedHour ? STATUS_CONFIG[selectedHour.operation_status] : null

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Monitoring Harian</h1>
          <div className={styles.locationInfo}>
            <MapPin size={13} />
            <span>{activeLocation.name}{activeLocation.province ? `, ${activeLocation.province}` : ''}</span>
            <span className={styles.dot}>•</span>
            <span>{format(new Date(), 'EEEE, dd MMM yyyy', { locale: id })}</span>
          </div>
        </div>
        <div className={styles.pageHeaderRight}>
          {lastRefreshed && (
            <span className={styles.lastRefresh}>
              <Clock size={12} />
              {format(lastRefreshed, 'HH:mm:ss')}
            </span>
          )}
          {countdown && (
            <span className={styles.countdown}>
              Refresh: {countdown}
            </span>
          )}
          <button
            className='btn btn-accent btn-sm'
            onClick={() => loadData(true)}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Memuat...' : 'Refresh Sekarang'}
          </button>
        </div>
      </div>

      {/* Error */}
      {loadError && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} />
          <span>{loadError}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && forecastData.length === 0 && (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${styles.skeletonCard} animate-pulse`} />
          ))}
        </div>
      )}

      {/* Main Content */}
      {!isLoading && forecastData.length > 0 && (
        <>
          {/* Current Status Banner */}
          {selectedHour && overallStatus && (
            <div className={styles.statusBanner} style={{ borderColor: overallStatus.color, background: `${overallStatus.color}14` }}>
              <div className={styles.statusBannerIcon} style={{ fontSize: 28 }}>{overallStatus.icon}</div>
              <div className={styles.statusBannerContent}>
                <div className={styles.statusBannerTitle} style={{ color: overallStatus.color }}>
                  {overallStatus.label}
                </div>
                <div className={styles.statusBannerReasons}>
                  {selectedHour.operation_reasons?.slice(0, 3).map((r, i) => (
                    <span key={i} className={styles.reasonTag}>{r}</span>
                  ))}
                </div>
              </div>
              <div className={styles.statusBannerMeta}>
                <span>{format(new Date(`${selectedHour.date}T${String(selectedHour.hour).padStart(2,'0')}:00`), 'HH:mm')}</span>
                <span className={styles.dataSource}>{selectedHour.data_source}</span>
              </div>
            </div>
          )}

          {/* Quick Stats Row */}
          {selectedHour && (
            <div className={styles.quickStats}>
              <StatCard icon={<Thermometer size={16} />} label="Suhu" value={`${selectedHour.temperature.toFixed(1)}°C`} />
              <StatCard icon={<CloudRain size={16} />} label="Curah Hujan" value={`${selectedHour.rainfall.toFixed(1)} mm`} color={selectedHour.rainfall > 0 ? '#3b82f6' : undefined} />
              <StatCard icon={<span style={{ fontSize: 16 }}>💧</span>} label="Prob. Hujan" value={`${selectedHour.rain_probability.toFixed(0)}%`} color={selectedHour.rain_probability >= 50 ? '#0ea5e9' : undefined} />
              <StatCard icon={<Wind size={16} />} label="Angin" value={`${selectedHour.wind_speed.toFixed(1)} km/h ${selectedHour.wind_direction_label}`} />
              <StatCard icon={<Droplets size={16} />} label="Kelembapan" value={`${selectedHour.humidity.toFixed(0)}%`} />
              <StatCard icon={<Eye size={16} />} label="Jarak Pandang" value={`${selectedHour.visibility.toFixed(1)} km`} color={selectedHour.visibility < 3 ? '#f59e0b' : undefined} />
              <StatCard icon={<Gauge size={16} />} label="Tekanan" value={`${selectedHour.pressure.toFixed(0)} hPa`} />
            </div>
          )}

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'table' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('table')}
            >Tabel Per Jam</button>
            <button
              className={`${styles.tab} ${activeTab === 'chart' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('chart')}
            >Grafik</button>
          </div>

          {/* Forecast Table */}
          {activeTab === 'table' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Jam</th>
                    <th>Kondisi</th>
                    <th>Suhu</th>
                    <th>Hujan (mm)</th>
                    <th>Prob.</th>
                    <th>Angin</th>
                    <th>Arah</th>
                    <th>Lembap</th>
                    <th>Pandang</th>
                    <th>Tekanan</th>
                    <th>Status</th>
                    <th>Aktual</th>
                  </tr>
                </thead>
                <tbody>
                  {displayForecasts.map((f) => {
                    const isCurrent = f.date === today && f.hour === currentHour
                    const isPast = f.date < today || (f.date === today && f.hour < currentHour)
                    const statusConf = STATUS_CONFIG[f.operation_status]
                    const actualVal = actuals[f.hour]
                    const hasActual = actualVal !== undefined

                    return (
                      <tr
                        key={`${f.date}-${f.hour}`}
                        className={`${styles.tableRow} ${isCurrent ? styles.currentHour : ''} ${isPast ? styles.pastHour : ''} ${selectedHour?.hour === f.hour && selectedHour?.date === f.date ? styles.selectedRow : ''}`}
                        onClick={() => setSelectedHour(f)}
                      >
                        <td className={styles.timeCell}>
                          <span className={styles.timeValue}>{String(f.hour).padStart(2, '0')}:00</span>
                          {isCurrent && <span className={styles.nowBadge}>SEKARANG</span>}
                        </td>
                        <td>
                          <div className={styles.conditionCell}>
                            <span>{getWeatherIcon(f.weather_code)}</span>
                            <span className={styles.conditionText}>{f.weather_condition}</span>
                          </div>
                        </td>
                        <td className={styles.numCell}>{f.temperature.toFixed(1)}°</td>
                        <td className={`${styles.numCell} ${f.rainfall > 0 ? styles.rainyCell : ''}`}>{f.rainfall.toFixed(1)}</td>
                        <td>
                          <div className={styles.probBar}>
                            <div className={styles.probFill} style={{ width: `${f.rain_probability}%`, background: f.rain_probability >= 70 ? '#ef4444' : f.rain_probability >= 40 ? '#f59e0b' : '#22c55e' }} />
                            <span className={styles.probText}>{f.rain_probability.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className={styles.numCell}>{f.wind_speed.toFixed(1)}</td>
                        <td className={styles.dirCell}>{f.wind_direction_label}</td>
                        <td className={styles.numCell}>{f.humidity.toFixed(0)}%</td>
                        <td className={`${styles.numCell} ${f.visibility < 3 ? styles.lowVisCell : ''}`}>{f.visibility.toFixed(1)}</td>
                        <td className={styles.numCell}>{f.pressure.toFixed(0)}</td>
                        <td>
                          <span className={`tag ${statusConf.tagClass}`}>{statusConf.shortLabel}</span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {isPast || isCurrent ? (
                            <div className={styles.actualButtons}>
                              <button
                                className={`${styles.actualBtn} ${hasActual && actualVal === true ? styles.actualBtnActive : ''}`}
                                onClick={() => handleActualToggle(f.hour, true)}
                                title="Hujan"
                              >☔</button>
                              <button
                                className={`${styles.actualBtn} ${hasActual && actualVal === false ? styles.actualBtnActiveDry : ''}`}
                                onClick={() => handleActualToggle(f.hour, false)}
                                title="Tidak Hujan"
                              >☀</button>
                            </div>
                          ) : (
                            <span className={styles.futureLabel}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Chart */}
          {activeTab === 'chart' && (
            <div className={styles.chartArea}>
              <WeatherChart data={displayForecasts} />
            </div>
          )}
        </>
      )}

      {/* No Data */}
      {!isLoading && forecastData.length === 0 && !loadError && (
        <div className={styles.noData}>
          <CloudRain size={40} />
          <p>Belum ada data cuaca. Klik "Refresh Sekarang" untuk memuat.</p>
          <button className='btn btn-accent' onClick={() => loadData(true)}>
            <RefreshCw size={14} />
            Muat Data Sekarang
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statContent}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue} style={color ? { color } : undefined}>{value}</span>
      </div>
    </div>
  )
}
