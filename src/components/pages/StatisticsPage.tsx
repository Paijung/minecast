// src/components/pages/StatisticsPage.tsx

import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { DailyStats, MonthlyStats } from '../../types'
import * as api from '../../services/api'
import { format, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell
} from 'recharts'
import { MapPin, TrendingUp, Droplets, CheckCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './StatisticsPage.module.css'

const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export default function StatisticsPage() {
  const { activeLocation, effectiveTheme } = useAppStore()

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [yearlyStats, setYearlyStats] = useState<MonthlyStats[]>([])
  const [monthlyDetail, setMonthlyDetail] = useState<MonthlyStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly')

  const gridColor = effectiveTheme === 'dark' ? '#1e2d3d' : '#e2e8f0'
  const textColor = effectiveTheme === 'dark' ? '#475569' : '#94a3b8'

  useEffect(() => {
    if (activeLocation?.id) loadStats()
  }, [activeLocation, selectedYear, selectedMonth])

  const loadStats = async () => {
    if (!activeLocation?.id) return
    setLoading(true)
    try {
      const [yearly, monthly] = await Promise.all([
        api.getYearlyStats(activeLocation.id, selectedYear),
        api.getMonthlyStats(activeLocation.id, selectedYear, selectedMonth),
      ])
      setYearlyStats(yearly)
      setMonthlyDetail(monthly)

      // Load daily stats for selected month (last 30 days sample)
      const dailyArr: DailyStats[] = []
      const now = new Date()
      for (let i = 29; i >= 0; i--) {
        const d = subDays(now, i)
        const dateStr = format(d, 'yyyy-MM-dd')
        const ds = await api.getDailyStats(activeLocation.id, dateStr)
        if (ds) dailyArr.push(ds)
      }
      setDailyStats(dailyArr)
    } catch (e) {
      console.error('Failed to load stats:', e)
    } finally {
      setLoading(false)
    }
  }

  if (!activeLocation) {
    return (
      <div className={styles.noLocation}>
        <MapPin size={40} />
        <p>Lokasi belum diatur. Pergi ke Pengaturan untuk mengatur lokasi.</p>
      </div>
    )
  }

  const yearlyChartData = yearlyStats.map((s, i) => ({
    name: MONTHS_ID[i],
    akurasi: parseFloat(s.accuracy_percent.toFixed(1)),
    hujan: s.rainy_days,
    kering: s.dry_days,
    curahHujan: parseFloat(s.total_rainfall.toFixed(1)),
  }))

  const dailyChartData = dailyStats.map(s => ({
    name: format(new Date(s.date), 'dd/MM'),
    akurasi: parseFloat(s.accuracy_percent.toFixed(1)),
    curahHujan: parseFloat(s.total_rainfall.toFixed(1)),
  }))

  const avgAccuracy = yearlyStats.length > 0
    ? yearlyStats.reduce((sum, s) => sum + s.accuracy_percent, 0) / yearlyStats.filter(s => s.accuracy_percent > 0).length || 0
    : 0

  const totalRainyDays = yearlyStats.reduce((s, m) => s + m.rainy_days, 0)
  const totalDryDays = yearlyStats.reduce((s, m) => s + m.dry_days, 0)
  const totalRainfall = yearlyStats.reduce((s, m) => s + m.total_rainfall, 0)
  const maxRainfall = Math.max(...yearlyStats.map(s => s.max_rainfall))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className={styles.tooltip}>
        <div className={styles.ttTitle}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} className={styles.ttRow}>
            <span className={styles.ttDot} style={{ background: p.color }} />
            <span className={styles.ttLabel}>{p.name}:</span>
            <span className={styles.ttVal}>{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Statistik & Akurasi</h1>
          <div className={styles.locationInfo}>
            <MapPin size={13} />
            <span>{activeLocation.name}{activeLocation.province ? `, ${activeLocation.province}` : ''}</span>
          </div>
        </div>
        <div className={styles.yearNav}>
          <button className='btn btn-ghost btn-sm' onClick={() => setSelectedYear(y => y - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span className={styles.yearLabel}>{selectedYear}</span>
          <button
            className='btn btn-ghost btn-sm'
            onClick={() => setSelectedYear(y => y + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Memuat statistik...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className={styles.kpiGrid}>
            <KpiCard
              icon={<TrendingUp size={18} />}
              label="Rata-rata Akurasi"
              value={`${isNaN(avgAccuracy) ? 0 : avgAccuracy.toFixed(1)}%`}
              color={avgAccuracy >= 70 ? '#22c55e' : avgAccuracy >= 50 ? '#f59e0b' : '#ef4444'}
              sub={`Tahun ${selectedYear}`}
            />
            <KpiCard
              icon={<Droplets size={18} />}
              label="Total Curah Hujan"
              value={`${totalRainfall.toFixed(0)} mm`}
              color="#3b82f6"
              sub={`Maks: ${maxRainfall.toFixed(0)} mm`}
            />
            <KpiCard
              icon={<span style={{ fontSize: 18 }}>🌧️</span>}
              label="Hari Hujan"
              value={`${totalRainyDays} hari`}
              color="#0ea5e9"
              sub={`Kering: ${totalDryDays} hari`}
            />
            <KpiCard
              icon={<CheckCircle size={18} />}
              label={`Akurasi ${MONTHS_ID[selectedMonth-1]}`}
              value={`${monthlyDetail?.accuracy_percent.toFixed(1) ?? 0}%`}
              color="#8b5cf6"
              sub={`Hujan: ${monthlyDetail?.rainy_days ?? 0} | Kering: ${monthlyDetail?.dry_days ?? 0}`}
            />
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'monthly' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('monthly')}
            >30 Hari Terakhir</button>
            <button
              className={`${styles.tab} ${activeTab === 'yearly' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('yearly')}
            >Tahunan ({selectedYear})</button>
          </div>

          {/* Charts Area */}
          <div className={styles.chartsArea}>
            {activeTab === 'yearly' && (
              <div className={styles.chartGrid}>
                {/* Yearly Accuracy */}
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Akurasi Forecast per Bulan (%)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={yearlyChartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="akurasi" name="Akurasi" radius={[4,4,0,0]} barSize={28}>
                        {yearlyChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.akurasi >= 70 ? '#22c55e' : entry.akurasi >= 50 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Rainy vs Dry Days */}
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Hari Hujan vs Kering per Bulan</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={yearlyChartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="hujan" name="Hari Hujan" fill="#3b82f6" radius={[3,3,0,0]} barSize={14} />
                      <Bar dataKey="kering" name="Hari Kering" fill="#f59e0b" radius={[3,3,0,0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Rainfall */}
                <div className={`${styles.chartCard} ${styles.fullWidth}`}>
                  <div className={styles.chartTitle}>Total Curah Hujan per Bulan (mm)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={yearlyChartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="curahHujan" name="Curah Hujan (mm)" fill="#0ea5e9" radius={[4,4,0,0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Table */}
                <div className={`${styles.chartCard} ${styles.fullWidth}`}>
                  <div className={styles.chartTitle}>Ringkasan Bulanan</div>
                  <div className={styles.monthTableWrapper}>
                    <table className={styles.monthTable}>
                      <thead>
                        <tr>
                          <th>Bulan</th>
                          <th>Akurasi</th>
                          <th>Hari Hujan</th>
                          <th>Hari Kering</th>
                          <th>Total Hujan (mm)</th>
                          <th>Maks. Hujan (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlyStats.map((s, i) => (
                          <tr key={i} className={styles.monthRow}>
                            <td className={styles.monthName}>{MONTHS_ID[i]}</td>
                            <td>
                              <span style={{ color: s.accuracy_percent >= 70 ? '#22c55e' : s.accuracy_percent >= 50 ? '#f59e0b' : s.accuracy_percent > 0 ? '#ef4444' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                                {s.accuracy_percent > 0 ? `${s.accuracy_percent.toFixed(1)}%` : '—'}
                              </span>
                            </td>
                            <td className={styles.monoCell}>{s.rainy_days || '—'}</td>
                            <td className={styles.monoCell}>{s.dry_days || '—'}</td>
                            <td className={styles.monoCell}>{s.total_rainfall > 0 ? s.total_rainfall.toFixed(1) : '—'}</td>
                            <td className={styles.monoCell}>{s.max_rainfall > 0 ? s.max_rainfall.toFixed(1) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'monthly' && (
              <div className={styles.chartGrid}>
                {/* Daily Accuracy Line */}
                <div className={`${styles.chartCard} ${styles.fullWidth}`}>
                  <div className={styles.chartTitle}>Akurasi Forecast - 30 Hari Terakhir (%)</div>
                  {dailyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={dailyChartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="akurasi" name="Akurasi %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={styles.noChartData}>Belum ada data akurasi</div>
                  )}
                </div>

                {/* Daily Rainfall */}
                <div className={`${styles.chartCard} ${styles.fullWidth}`}>
                  <div className={styles.chartTitle}>Curah Hujan - 30 Hari Terakhir (mm)</div>
                  {dailyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={dailyChartData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
                        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="curahHujan" name="Curah Hujan (mm)" fill="#3b82f6" radius={[3,3,0,0]} opacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={styles.noChartData}>Belum ada data curah hujan</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: string; sub: string }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon} style={{ color, background: `${color}18` }}>{icon}</div>
      <div className={styles.kpiContent}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue} style={{ color }}>{value}</span>
        <span className={styles.kpiSub}>{sub}</span>
      </div>
    </div>
  )
}
