// src/components/charts/WeatherChart.tsx

import { ForecastHour } from '../../types'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, ReferenceLine
} from 'recharts'
import { useAppStore } from '../../store/appStore'
import styles from './WeatherChart.module.css'
import { format } from 'date-fns'

interface Props {
  data: ForecastHour[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipLabel}>{p.name}:</span>
          <span className={styles.tooltipValue}>{p.value?.toFixed(1)} {p.unit}</span>
        </div>
      ))}
    </div>
  )
}

export default function WeatherChart({ data }: Props) {
  const { effectiveTheme } = useAppStore()

  const chartData = data.map(d => ({
    time: `${String(d.hour).padStart(2, '0')}:00`,
    temp: d.temperature,
    rain: d.rainfall,
    prob: d.rain_probability,
    humidity: d.humidity,
    wind: d.wind_speed,
    visibility: d.visibility,
  }))

  const gridColor = effectiveTheme === 'dark' ? '#1e2d3d' : '#e2e8f0'
  const textColor = effectiveTheme === 'dark' ? '#475569' : '#94a3b8'
  const currentHour = new Date().getHours()
  const currentTime = `${String(currentHour).padStart(2, '0')}:00`

  return (
    <div className={styles.container}>
      {/* Temperature + Rain */}
      <div className={styles.chartBlock}>
        <div className={styles.chartTitle}>Suhu & Curah Hujan</div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: textColor, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="temp"
              orientation="left"
              tick={{ fontSize: 10, fill: textColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}°`}
              width={35}
            />
            <YAxis
              yAxisId="rain"
              orientation="right"
              tick={{ fontSize: 10, fill: '#3b82f6' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}mm`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="temp" x={currentTime} stroke="#0ea5e9" strokeDasharray="4 2" strokeWidth={1.5} />
            <Bar yAxisId="rain" dataKey="rain" name="Hujan" unit="mm" fill="#3b82f6" opacity={0.6} radius={[2,2,0,0]} barSize={8} />
            <Line yAxisId="temp" type="monotone" dataKey="temp" name="Suhu" unit="°C" stroke="#f97316" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Probability + Humidity */}
      <div className={styles.chartBlock}>
        <div className={styles.chartTitle}>Probabilitas Hujan & Kelembapan</div>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: textColor, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: textColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
              width={35}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={currentTime} stroke="#0ea5e9" strokeDasharray="4 2" strokeWidth={1.5} />
            <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} opacity={0.5} />
            <Area type="monotone" dataKey="prob" name="Prob. Hujan" unit="%" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="humidity" name="Kelembapan" unit="%" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Wind + Visibility */}
      <div className={styles.chartBlock}>
        <div className={styles.chartTitle}>Angin & Jarak Pandang</div>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: textColor, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="wind"
              orientation="left"
              tick={{ fontSize: 10, fill: textColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}`}
              width={35}
            />
            <YAxis
              yAxisId="vis"
              orientation="right"
              tick={{ fontSize: 10, fill: '#10b981' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}km`}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="wind" x={currentTime} stroke="#0ea5e9" strokeDasharray="4 2" strokeWidth={1.5} />
            <Line yAxisId="wind" type="monotone" dataKey="wind" name="Angin" unit=" km/h" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line yAxisId="vis" type="monotone" dataKey="visibility" name="Pandang" unit=" km" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
