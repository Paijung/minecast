# MineCast - Technical Architecture Documentation

## Overview

MineCast is a desktop Windows application built with **Tauri v1** (Rust backend) and **React + TypeScript** (frontend). It monitors operational weather conditions for coal mining operations.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                   REACT FRONTEND (TSX)                   │
│  HomePage │ MonitoringPage │ HistoryPage │ StatisticsPage │
│  SettingsPage │ WeatherChart │ ToastContainer             │
├─────────────────────────────────────────────────────────┤
│              ZUSTAND STATE MANAGEMENT                     │
│     appStore: page, location, forecast, actuals, theme   │
├─────────────────────────────────────────────────────────┤
│              TAURI IPC BRIDGE (invoke)                   │
│              src/services/api.ts                         │
├─────────────────────────────────────────────────────────┤
│                  RUST BACKEND                            │
│   main.rs (commands) │ database.rs │ weather.rs │ export │
├─────────────────────────────────────────────────────────┤
│                  SYSTEM LAYER                            │
│   SQLite (rusqlite bundled) │ HTTP (reqwest) │ FS        │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 18.2 | UI Components |
| Language | TypeScript | 5.3 | Type Safety |
| Bundler | Vite | 5.2 | Fast builds |
| State | Zustand | 4.5 | Global state |
| Charts | Recharts | 2.10 | Data visualization |
| Backend | Tauri | 1.6 | Desktop runtime |
| Language | Rust | 1.70+ | Native performance |
| Database | SQLite | bundled | Local persistence |
| HTTP | reqwest | 0.12 | API calls |
| Date | chrono | 0.4 | Date handling |
| Archive | zip | 0.6 | Backup compression |
| Excel | xlsxwriter | 0.6 | Export |
| Icons | Lucide React | 0.378 | UI icons |

## Tauri Commands (IPC)

All frontend-to-backend communication via `invoke()`:

```
Location:
  cmd_search_location(query)        → LocationResult[]
  cmd_save_location(location)       → i64 (id)
  cmd_get_active_location()         → Location?
  cmd_get_all_locations()           → Location[]

Weather:
  cmd_fetch_weather(lat, lon, id)   → ForecastHour[] (fetches + saves)
  cmd_get_forecasts_date(id, date)  → ForecastRecord[]
  cmd_get_forecasts_range(id, s, e) → ForecastRecord[]

Actuals:
  cmd_save_actual(actual)           → void (also recalculates accuracy)
  cmd_get_actuals_date(id, date)    → ActualRecord[]

Statistics:
  cmd_get_daily_stats(id, date)     → DailyStats?
  cmd_get_monthly_stats(id, y, m)   → MonthlyStats
  cmd_get_yearly_stats(id, year)    → MonthlyStats[]

Settings:
  cmd_get_setting(key)              → String?
  cmd_set_setting(key, value)       → void
  cmd_get_all_settings()            → AppSettings[]

Logs:
  cmd_get_logs(limit)               → JSON[]
  cmd_cleanup_logs(retention_days)  → void
  cmd_write_log_file(msg, level)    → void

Export:
  cmd_export_daily(id, name, date)  → String (filepath)
  cmd_export_range(id, name, s, e)  → String (filepath)

Database:
  cmd_backup_database()             → String (backup path)
  cmd_reset_database()              → void (auto-backups first)

System:
  cmd_get_paths()                   → AppPaths
  cmd_open_folder(path)             → void
  cmd_open_file(path)               → void
  cmd_get_app_version()             → String
```

## Weather Data Pipeline

```
fetchWeather(lat, lon)
    │
    ├── try fetch_bmkg(lat, lon)
    │       │
    │       └── GET https://api.bmkg.go.id/publik/prakiraan-cuaca
    │               ?adm4={lat},{lon}
    │               Parse JSON → BmkgForecastResponse
    │               Map to WeatherData[]
    │               (rainfall estimated from weather code)
    │               (pressure = 0 if not in BMKG response)
    │
    ├── if BMKG fails → fetch_open_meteo(lat, lon)
    │
    └── if BMKG succeeds but incomplete (pressure/visibility = 0):
            fetch_open_meteo() and fill only missing fields
            (Hybrid approach: BMKG + Open-Meteo supplement)
    │
    └── for each WeatherData:
            calculate_operation_status(data) → OperationStatus
            build ForecastRecord
            save_forecasts() → SQLite
            return JSON to frontend
```

## Operation Status Algorithm

```rust
fn calculate_operation_status(data: &WeatherData) -> OperationStatus {
    let mut risk_score = 0i32;
    let mut reasons = Vec::new();

    // Rainfall scoring
    match data.rainfall {
        r if r >= 50.0 => { risk_score += 100; reasons.push("Hujan sangat lebat") }
        r if r >= 20.0 => { risk_score += 70;  reasons.push("Hujan lebat") }
        r if r >= 5.0  => { risk_score += 40;  reasons.push("Hujan sedang") }
        r if r > 0.5   => { risk_score += 20;  reasons.push("Hujan ringan") }
        _ => {}
    }

    // Rain probability scoring
    match data.rain_probability {
        p if p >= 80.0 => { risk_score += 40; }
        p if p >= 50.0 => { risk_score += 20; }
        _ => {}
    }

    // Wind speed scoring (km/h)
    match data.wind_speed {
        w if w >= 50.0 => { risk_score += 100; }
        w if w >= 35.0 => { risk_score += 60;  }
        w if w >= 25.0 => { risk_score += 20;  }
        _ => {}
    }

    // Visibility scoring (km)
    match data.visibility {
        v if v < 0.5 => { risk_score += 80; }
        v if v < 1.0 => { risk_score += 50; }
        v if v < 3.0 => { risk_score += 20; }
        _ => {}
    }

    // Weather condition keywords
    if condition contains "petir" or "badai" → risk_score += 100
    if condition contains "lebat"            → risk_score += 50
    if condition contains "kabut" or "asap"  → risk_score += 30

    // Final status
    match risk_score {
        s if s >= 100 => TIDAK_DIREKOMENDASIKAN (⛔)
        s if s >= 60  => RISIKO_TINGGI (🔴)
        s if s >= 20  => WASPADA (🟡)
        _             => AMAN (🟢)
    }
}
```

## Auto-Refresh Strategy

```
App Start
    │
    └── loadData() → fetch fresh weather
    │
    └── scheduleNextRefresh()
            │
            ├── Calculate time until next full hour (:00)
            ├── Set setTimeout for that duration
            ├── Set countdown display interval (1s)
            │
            └── On trigger:
                    loadData()
                    scheduleNextRefresh()   ← reschedule without resetting
```

**Manual refresh** (button) calls `loadData()` WITHOUT calling `scheduleNextRefresh()`, preserving the scheduled timer.

## Accuracy Calculation

```
For each ActualRecord at (location_id, date, hour):
    Find matching ForecastRecord at same (date, hour)

    forecast_predicts_rain = rain_probability >= 50% OR rainfall > 0.5mm
    actual_is_raining      = ActualRecord.is_raining

    is_accurate = (forecast_predicts_rain == actual_is_raining)

    Save to accuracy table

Daily accuracy % = (correct_count / total_count) * 100
```

## Excel Export Structure

```
Sheet 1: "Data Forecast"
  Row 1: Title merged across columns
  Row 2: Location + date
  Row 3: Export timestamp
  Row 4: (empty)
  Row 5: Column headers (bold, dark blue background)
  Row 6+: Data rows with conditional color on Status column:
    - AMAN            → green background
    - WASPADA         → yellow background
    - RISIKO_TINGGI   → orange/red background
    - TIDAK_DIREK.    → dark red background, white text

Sheet 2: "Ringkasan"
  Summary statistics for the exported period
```

## File System Layout (End User)

```
%APPDATA%\MineCast\
├── minecast.db          ← SQLite database
├── README.txt
├── CHANGELOG.txt
├── TROUBLESHOOTING.txt
├── Backup\
│   └── minecast_backup_YYYYMMDD_HHMMSS.zip
├── Export\
│   └── MineCast_Location_YYYYMMDD.xlsx
└── Logs\
    └── minecast_YYYY-MM-DD.log
```

## Security

- CSP policy defined in tauri.conf.json restricts connections to:
  - api.bmkg.go.id
  - api.open-meteo.com
  - nominatim.openstreetmap.org
  - geocoding-api.open-meteo.com
- No telemetry or analytics
- All data stored locally
- No external authentication required
- Network access only for weather API calls

## Performance Optimizations

- SQLite WAL mode for concurrent reads
- mmap_size = 30MB for large data sets
- Vite code splitting: React, Charts in separate chunks
- release profile: opt-level="z", LTO=true, strip=true
- Recharts uses ResponsiveContainer for efficient re-renders
- Zustand for minimal re-renders (selector-based)
- CSS modules for scoped, optimized styles
- No heavy UI framework dependencies

## Theme System

Themes are applied via `data-theme` attribute on `<html>`:
```css
[data-theme="light"] { --bg-base: #f0f4f8; ... }
[data-theme="dark"]  { --bg-base: #0a0f1a; ... }
```

System theme detection:
```js
window.matchMedia('(prefers-color-scheme: dark)').matches
```

Setting persisted in SQLite `settings` table key `theme`.
