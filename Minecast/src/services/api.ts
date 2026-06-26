// src/services/api.ts
// MineCast Tauri API Bridge

import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/shell'
import {
  Location, ForecastHour, ForecastRecord, ActualRecord,
  DailyStats, MonthlyStats, AppSettings, LocationResult, AppPaths
} from '../types'

// ---- Location ----

export async function searchLocation(query: string): Promise<LocationResult[]> {
  return invoke('cmd_search_location', { query })
}

export async function saveLocation(location: Location): Promise<number> {
  return invoke('cmd_save_location', { location })
}

export async function getActiveLocation(): Promise<Location | null> {
  return invoke('cmd_get_active_location')
}

export async function getAllLocations(): Promise<Location[]> {
  return invoke('cmd_get_all_locations')
}

// ---- Weather ----

export async function fetchWeather(lat: number, lon: number, locationId: number): Promise<ForecastHour[]> {
  return invoke('cmd_fetch_weather', { lat, lon, locationId })
}

export async function getForecastsDate(locationId: number, date: string): Promise<ForecastRecord[]> {
  return invoke('cmd_get_forecasts_date', { locationId, date })
}

export async function getForecastsRange(locationId: number, start: string, end: string): Promise<ForecastRecord[]> {
  return invoke('cmd_get_forecasts_range', { locationId, start, end })
}

// ---- Actuals ----

export async function saveActual(actual: ActualRecord): Promise<void> {
  return invoke('cmd_save_actual', { actual })
}

export async function getActualsDate(locationId: number, date: string): Promise<ActualRecord[]> {
  return invoke('cmd_get_actuals_date', { locationId, date })
}

// ---- Statistics ----

export async function getDailyStats(locationId: number, date: string): Promise<DailyStats | null> {
  return invoke('cmd_get_daily_stats', { locationId, date })
}

export async function getMonthlyStats(locationId: number, year: number, month: number): Promise<MonthlyStats> {
  return invoke('cmd_get_monthly_stats', { locationId, year, month })
}

export async function getYearlyStats(locationId: number, year: number): Promise<MonthlyStats[]> {
  return invoke('cmd_get_yearly_stats', { locationId, year })
}

// ---- Settings ----

export async function getSetting(key: string): Promise<string | null> {
  return invoke('cmd_get_setting', { key })
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke('cmd_set_setting', { key, value })
}

export async function getAllSettings(): Promise<AppSettings[]> {
  return invoke('cmd_get_all_settings')
}

// ---- Logs ----

export async function getLogs(limit: number): Promise<any[]> {
  return invoke('cmd_get_logs', { limit })
}

export async function cleanupLogs(retentionDays: number): Promise<void> {
  return invoke('cmd_cleanup_logs', { retentionDays })
}

export async function writeLog(message: string, level: string = 'INFO'): Promise<void> {
  return invoke('cmd_write_log_file', { message, level })
}

// ---- Export ----

export async function exportDaily(
  locationId: number,
  locationName: string,
  date: string
): Promise<string> {
  return invoke('cmd_export_daily', { locationId, locationName, date })
}

export async function exportRange(
  locationId: number,
  locationName: string,
  startDate: string,
  endDate: string
): Promise<string> {
  return invoke('cmd_export_range', { locationId, locationName, startDate, endDate })
}

// ---- Database ----

export async function backupDatabase(): Promise<string> {
  return invoke('cmd_backup_database')
}

export async function resetDatabase(): Promise<void> {
  return invoke('cmd_reset_database')
}

// ---- Paths & Files ----

export async function getPaths(): Promise<AppPaths> {
  return invoke('cmd_get_paths')
}

export async function openFolder(path: string): Promise<void> {
  return invoke('cmd_open_folder', { path })
}

export async function openFile(path: string): Promise<void> {
  return invoke('cmd_open_file', { path })
}

export async function getAppVersion(): Promise<string> {
  return invoke('cmd_get_app_version')
}
