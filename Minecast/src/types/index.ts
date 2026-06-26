// src/types/index.ts

export interface Location {
  id?: number
  name: string
  lat: number
  lon: number
  region?: string
  province?: string
  country: string
  is_active: boolean
  created_at: string
}

export interface ForecastHour {
  date: string
  hour: number
  temperature: number
  rainfall: number
  rain_probability: number
  weather_condition: string
  weather_code: number
  wind_speed: number
  wind_direction: number
  wind_direction_label: string
  humidity: number
  visibility: number
  pressure: number
  data_source: string
  operation_status: OperationStatusCode
  operation_status_label: string
  operation_color: string
  operation_reasons: string[]
}

export interface ForecastRecord {
  id?: number
  location_id: number
  forecast_date: string
  forecast_hour: number
  fetched_at: string
  temperature: number
  rainfall: number
  rain_probability: number
  weather_condition: string
  weather_code: number
  wind_speed: number
  wind_direction: number
  wind_direction_label: string
  humidity: number
  visibility: number
  pressure: number
  data_source: string
  operation_status: OperationStatusCode
  operation_reasons: string
}

export interface ActualRecord {
  id?: number
  location_id: number
  record_date: string
  record_hour: number
  is_raining: boolean
  notes?: string
  created_at: string
}

export interface DailyStats {
  date: string
  accuracy_percent: number
  total_forecasts: number
  correct_forecasts: number
  rainy_hours: number
  dry_hours: number
  total_rainfall: number
  max_rainfall: number
}

export interface MonthlyStats {
  year_month: string
  accuracy_percent: number
  rainy_days: number
  dry_days: number
  total_rainfall: number
  max_rainfall: number
}

export interface AppSettings {
  key: string
  value: string
}

export type OperationStatusCode = 
  | 'AMAN' 
  | 'WASPADA' 
  | 'RISIKO_TINGGI' 
  | 'TIDAK_DIREKOMENDASIKAN'

export type Page = 
  | 'home'
  | 'monitoring'
  | 'history'
  | 'statistics'
  | 'settings'

export type Theme = 'light' | 'dark' | 'system'

export interface LocationResult {
  name: string
  lat: number
  lon: number
  region?: string
  province?: string
  country: string
  display_name: string
}

export interface AppPaths {
  app_dir: string
  backup_dir: string
  export_dir: string
  log_dir: string
}

export const STATUS_CONFIG: Record<OperationStatusCode, {
  label: string
  shortLabel: string
  color: string
  bgColor: string
  textColor: string
  tagClass: string
  icon: string
}> = {
  AMAN: {
    label: '🟢 Aman',
    shortLabel: 'Aman',
    color: '#22c55e',
    bgColor: '#dcfce7',
    textColor: '#15803d',
    tagClass: 'tag-safe',
    icon: '🟢',
  },
  WASPADA: {
    label: '🟡 Waspada',
    shortLabel: 'Waspada',
    color: '#f59e0b',
    bgColor: '#fef9c3',
    textColor: '#b45309',
    tagClass: 'tag-watch',
    icon: '🟡',
  },
  RISIKO_TINGGI: {
    label: '🔴 Risiko Tinggi',
    shortLabel: 'Risiko Tinggi',
    color: '#ef4444',
    bgColor: '#fee2e2',
    textColor: '#b91c1c',
    tagClass: 'tag-high',
    icon: '🔴',
  },
  TIDAK_DIREKOMENDASIKAN: {
    label: '⛔ Tidak Direkomendasikan',
    shortLabel: 'Tidak Direk.',
    color: '#dc2626',
    bgColor: '#fca5a5',
    textColor: '#991b1b',
    tagClass: 'tag-no',
    icon: '⛔',
  },
}

export const WEATHER_ICONS: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  4: '🌫️',
  5: '🌫️',
  10: '💨',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  60: '🌦️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  95: '⛈️',
  97: '⛈️',
  100: '☀️',
  101: '🌤️',
  102: '⛅',
  103: '⛅',
  104: '☁️',
}

export function getWeatherIcon(code: number): string {
  return WEATHER_ICONS[code] || '🌡️'
}
