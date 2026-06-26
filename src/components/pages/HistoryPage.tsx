// src/components/pages/HistoryPage.tsx

import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { ForecastRecord, ActualRecord, STATUS_CONFIG, getWeatherIcon } from '../../types'
import * as api from '../../services/api'
import { format, subDays, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import { Search, Download, Calendar, MapPin, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import styles from './HistoryPage.module.css'

export default function HistoryPage() {
  const { activeLocation, addToast } = useAppStore()

  const [searchDate, setSearchDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [forecasts, setForecasts] = useState<ForecastRecord[]>([])
  const [actuals, setActuals] = useState<ActualRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [exportStart, setExportStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [exportEnd, setExportEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exporting, setExporting] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  const handleSearch = async () => {
    if (!activeLocation?.id) {
      addToast({ type: 'error', message: 'Lokasi belum diatur' })
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const [fc, ac] = await Promise.all([
        api.getForecastsDate(activeLocation.id, searchDate),
        api.getActualsDate(activeLocation.id, searchDate),
      ])
      setForecasts(fc)
      setActuals(ac)

      // Calculate accuracy
      if (fc.length > 0 && ac.length > 0) {
        const matched = ac.filter(a => {
          const f = fc.find(f => f.forecast_hour === a.record_hour)
          if (!f) return false
          const forecastRain = f.rain_probability >= 50 || f.rainfall > 0.5
          return forecastRain === a.is_raining
        })
        setAccuracy((matched.length / ac.length) * 100)
      } else {
        setAccuracy(null)
      }
    } catch (e: any) {
      addToast({ type: 'error', message: 'Gagal memuat data histori' })
    } finally {
      setLoading(false)
    }
  }

  const handleExportDaily = async () => {
    if (!activeLocation?.id) return
    setExporting(true)
    try {
      const path = await api.exportDaily(activeLocation.id, activeLocation.name, searchDate)
      addToast({ type: 'success', message: `Export berhasil: ${path.split('\\').pop()}` })
    } catch (e: any) {
      addToast({ type: 'error', message: 'Gagal export Excel' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportRange = async () => {
    if (!activeLocation?.id) return
    setExporting(true)
    try {
      const path = await api.exportRange(activeLocation.id, activeLocation.name, exportStart, exportEnd)
      addToast({ type: 'success', message: `Export berhasil: ${path.split('\\').pop()}` })
    } catch (e: any) {
      addToast({ type: 'error', message: 'Gagal export rentang tanggal' })
    } finally {
      setExporting(false)
    }
  }

  const getActualForHour = (hour: number) => actuals.find(a => a.record_hour === hour)

  if (!activeLocation) {
    return (
      <div className={styles.noLocation}>
        <MapPin size={40} />
        <p>Lokasi belum diatur. Pergi ke Pengaturan untuk mengatur lokasi.</p>
      </div>
    )
  }

  const displayDate = searchDate
    ? format(parseISO(searchDate), 'EEEE, dd MMMM yyyy', { locale: id })
    : ''

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Database Histori</h1>
          <div className={styles.locationInfo}>
            <MapPin size={13} />
            <span>{activeLocation.name}{activeLocation.province ? `, ${activeLocation.province}` : ''}</span>
          </div>
        </div>
      </div>

      {/* Search Panel */}
      <div className={styles.searchPanel}>
        <div className={styles.searchRow}>
          <div className={styles.searchGroup}>
            <label className={styles.label}>
              <Calendar size={13} /> Cari Tanggal
            </label>
            <input
              type="date"
              className='input'
              value={searchDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => setSearchDate(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
          <button className='btn btn-accent' onClick={handleSearch} disabled={loading}>
            <Search size={14} />
            {loading ? 'Mencari...' : 'Cari Data'}
          </button>
          {searched && forecasts.length > 0 && (
            <button className='btn btn-secondary btn-sm' onClick={handleExportDaily} disabled={exporting}>
              <Download size={13} />
              Export Hari Ini
            </button>
          )}
        </div>

        {/* Export Range */}
        <div className={styles.exportRow}>
          <span className={styles.exportLabel}>Export Rentang:</span>
          <input
            type="date"
            className='input'
            value={exportStart}
            max={exportEnd}
            onChange={e => setExportStart(e.target.value)}
            style={{ width: 160 }}
          />
          <span className={styles.rangeSep}>s/d</span>
          <input
            type="date"
            className='input'
            value={exportEnd}
            min={exportStart}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={e => setExportEnd(e.target.value)}
            style={{ width: 160 }}
          />
          <button className='btn btn-secondary btn-sm' onClick={handleExportRange} disabled={exporting}>
            <Download size={13} />
            {exporting ? 'Mengekspor...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <>
          {/* Stats bar */}
          {forecasts.length > 0 && (
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Tanggal</span>
                <span className={styles.statItemValue}>{displayDate}</span>
              </div>
              <div className={styles.statItemDivider} />
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Total Data</span>
                <span className={styles.statItemValue}>{forecasts.length} jam</span>
              </div>
              <div className={styles.statItemDivider} />
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Input Aktual</span>
                <span className={styles.statItemValue}>{actuals.length} jam</span>
              </div>
              {accuracy !== null && (
                <>
                  <div className={styles.statItemDivider} />
                  <div className={styles.statItem}>
                    <span className={styles.statItemLabel}>Akurasi</span>
                    <span className={styles.statItemValue} style={{ color: accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {accuracy.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
              <div className={styles.statItemDivider} />
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Sumber</span>
                <span className={styles.statItemValue}>{forecasts[0]?.data_source || '-'}</span>
              </div>
            </div>
          )}

          {/* Data Table */}
          {forecasts.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Jam</th>
                    <th>Kondisi</th>
                    <th>Suhu</th>
                    <th>Hujan (mm)</th>
                    <th>Prob.(%)</th>
                    <th>Angin</th>
                    <th>Lembap</th>
                    <th>Pandang</th>
                    <th>Status</th>
                    <th>Aktual</th>
                    <th>Akurasi</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((f, idx) => {
                    const actual = getActualForHour(f.forecast_hour)
                    const hasActual = actual !== undefined
                    const forecastRain = f.rain_probability >= 50 || f.rainfall > 0.5
                    const isAccurate = hasActual ? forecastRain === actual!.is_raining : null
                    const statusConf = STATUS_CONFIG[f.operation_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.AMAN
                    const isExpanded = expandedRow === idx
                    let reasons: string[] = []
                    try { reasons = JSON.parse(f.operation_reasons || '[]') } catch {}

                    return (
                      <>
                        <tr
                          key={`${f.forecast_date}-${f.forecast_hour}`}
                          className={`${styles.tableRow} ${isExpanded ? styles.expanded : ''}`}
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                        >
                          <td className={styles.expandCell}>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </td>
                          <td className={styles.timeCell}>
                            <span className={styles.timeVal}>{String(f.forecast_hour).padStart(2,'0')}:00</span>
                          </td>
                          <td>
                            <div className={styles.condCell}>
                              <span>{getWeatherIcon(f.weather_code)}</span>
                              <span className={styles.condText}>{f.weather_condition}</span>
                            </div>
                          </td>
                          <td className={styles.mono}>{f.temperature.toFixed(1)}°</td>
                          <td className={`${styles.mono} ${f.rainfall > 0 ? styles.rainVal : ''}`}>{f.rainfall.toFixed(1)}</td>
                          <td className={styles.mono}>{f.rain_probability.toFixed(0)}%</td>
                          <td className={styles.mono}>{f.wind_speed.toFixed(1)} {f.wind_direction_label}</td>
                          <td className={styles.mono}>{f.humidity.toFixed(0)}%</td>
                          <td className={styles.mono}>{f.visibility.toFixed(1)} km</td>
                          <td>
                            <span className={`tag ${statusConf.tagClass}`}>{statusConf.shortLabel}</span>
                          </td>
                          <td>
                            {hasActual ? (
                              <span className={actual!.is_raining ? styles.actualRain : styles.actualDry}>
                                {actual!.is_raining ? '☔ Hujan' : '☀ Kering'}
                              </span>
                            ) : <span className={styles.noActual}>—</span>}
                          </td>
                          <td>
                            {isAccurate !== null ? (
                              isAccurate
                                ? <span className={styles.accurate}><CheckCircle size={14} /> Tepat</span>
                                : <span className={styles.inaccurate}><XCircle size={14} /> Meleset</span>
                            ) : <span className={styles.noActual}>—</span>}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`exp-${idx}`} className={styles.detailRow}>
                            <td colSpan={12}>
                              <div className={styles.detailContent}>
                                <div className={styles.detailGrid}>
                                  <div>
                                    <span className={styles.detailLabel}>Tekanan Udara</span>
                                    <span className={styles.detailVal}>{f.pressure.toFixed(1)} hPa</span>
                                  </div>
                                  <div>
                                    <span className={styles.detailLabel}>Arah Angin</span>
                                    <span className={styles.detailVal}>{f.wind_direction}° ({f.wind_direction_label})</span>
                                  </div>
                                  <div>
                                    <span className={styles.detailLabel}>Sumber Data</span>
                                    <span className={styles.detailVal}>{f.data_source}</span>
                                  </div>
                                  <div>
                                    <span className={styles.detailLabel}>Diambil Pada</span>
                                    <span className={styles.detailVal}>{f.fetched_at}</span>
                                  </div>
                                </div>
                                {reasons.length > 0 && (
                                  <div className={styles.detailReasons}>
                                    <span className={styles.detailLabel}>Alasan Status Operasi:</span>
                                    <div className={styles.reasonsList}>
                                      {reasons.map((r, ri) => <span key={ri} className={styles.reasonTag}>{r}</span>)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            !loading && (
              <div className={styles.noData}>
                <Calendar size={36} />
                <p>Tidak ada data untuk tanggal <strong>{displayDate}</strong></p>
                <p className={styles.noDataHint}>Data hanya tersedia untuk tanggal yang pernah dimuat oleh aplikasi.</p>
              </div>
            )
          )}
        </>
      )}

      {!searched && (
        <div className={styles.initial}>
          <Calendar size={40} />
          <p>Pilih tanggal dan klik "Cari Data" untuk melihat histori cuaca.</p>
        </div>
      )}
    </div>
  )
}
