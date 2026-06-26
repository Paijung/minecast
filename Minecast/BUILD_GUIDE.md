# MineCast - Complete Build Guide

## Prerequisites (Developer Machine Only)

These are required only on the **build machine**, NOT on end-user computers.

```
- Windows 10 or 11 (64-bit)
- Node.js v18+ (https://nodejs.org)
- Rust (https://rustup.rs)
- Visual Studio C++ Build Tools 2019+
- WebView2 (pre-installed on Win10/11)
```

## Step 1: Install Rust

```powershell
# Open PowerShell as Administrator
winget install Rustlang.Rustup

# Or download from:
# https://win.rustup.rs/

# After install, verify:
rustc --version
cargo --version
```

## Step 2: Install Node.js

```powershell
winget install OpenJS.NodeJS.LTS

# Verify:
node --version
npm --version
```

## Step 3: Install Visual Studio Build Tools

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
# During install, select: "Desktop development with C++"
```

## Step 4: Clone / Setup Project

```powershell
# Navigate to project folder
cd C:\MineCast

# Install Node.js dependencies
npm install

# Install Tauri CLI globally (optional)
npm install -g @tauri-apps/cli
```

## Step 5: Generate App Icons

```powershell
# Install Python dependencies (optional, for better icons)
pip install Pillow

# Generate icons
python generate_icons.py

# OR manually place your icons in src-tauri/icons/:
# - 32x32.png
# - 128x128.png
# - 128x128@2x.png
# - icon.icns  (macOS, can be placeholder)
# - icon.ico   (Windows)
```

## Step 6: Development Mode

```powershell
# Start development server
npm run tauri dev
```

The app will open automatically in development mode with hot-reload.

## Step 7: Build Production

```powershell
# Build the release binary + installer
npm run tauri build
```

Build output will be in:
```
src-tauri/target/release/
src-tauri/target/release/bundle/nsis/    <- NSIS .exe installer
src-tauri/target/release/bundle/msi/     <- MSI installer (optional)
```

## Step 8: Find Your Installer

```
src-tauri/target/release/bundle/nsis/MineCast_1.0.0_x64-setup.exe
```

This `.exe` file is the **complete standalone installer** for end users.

## End User Requirements

End users need:
- Windows 10 version 1803+ or Windows 11
- WebView2 Runtime (usually pre-installed, or auto-downloaded during install)
- ~30 MB disk space
- Internet connection for weather data

**NO Node.js, Python, or other runtimes required.**

---

## Project Structure

```
minecast/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component
│   ├── index.css                 # Global styles
│   ├── types/
│   │   └── index.ts              # TypeScript types
│   ├── store/
│   │   └── appStore.ts           # Zustand global state
│   ├── services/
│   │   └── api.ts                # Tauri command bridge
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx       # Navigation sidebar
│       │   └── TitleBar.tsx      # App title bar
│       ├── pages/
│       │   ├── HomePage.tsx      # Main menu page
│       │   ├── MonitoringPage.tsx # Weather monitoring
│       │   ├── HistoryPage.tsx   # Data history
│       │   ├── StatisticsPage.tsx # Stats & accuracy
│       │   └── SettingsPage.tsx  # App settings
│       ├── charts/
│       │   └── WeatherChart.tsx  # Recharts visualizations
│       └── ui/
│           └── ToastContainer.tsx # Toast notifications
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri commands, app entry
│   │   ├── database.rs           # SQLite operations
│   │   ├── weather.rs            # BMKG + Open-Meteo APIs
│   │   └── export.rs             # Excel export
│   ├── icons/                    # App icons
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Build script
│   └── tauri.conf.json           # Tauri configuration
│
├── package.json                  # Node dependencies
├── vite.config.ts                # Vite bundler config
├── tsconfig.json                 # TypeScript config
├── generate_icons.py             # Icon generator
└── BUILD_GUIDE.md                # This file
```

---

## Database Schema

SQLite database stored at: `%APPDATA%\MineCast\minecast.db`

```sql
-- Active/historic locations
locations (id, name, lat, lon, region, province, country, is_active, created_at)

-- Hourly forecast data from BMKG/Open-Meteo
forecasts (id, location_id, forecast_date, forecast_hour, fetched_at,
           temperature, rainfall, rain_probability, weather_condition,
           weather_code, wind_speed, wind_direction, wind_direction_label,
           humidity, visibility, pressure, data_source,
           operation_status, operation_reasons)

-- User-input actual weather observations
actuals (id, location_id, record_date, record_hour, is_raining, notes, created_at)

-- Calculated forecast accuracy
accuracy (id, location_id, record_date, record_hour,
          forecast_rain_prob, forecast_rainfall,
          actual_is_raining, is_accurate, created_at)

-- App configuration key-value store
settings (key TEXT PRIMARY KEY, value TEXT)

-- Activity log
activity_log (id, level, category, message, detail, created_at)
```

---

## Data Flow

```
User opens Monitoring Page
    ↓
App checks active location from SQLite
    ↓
Calls fetchWeather(lat, lon) in Rust
    ↓
Try BMKG API (https://api.bmkg.go.id)
    ↓ (if BMKG fails or incomplete)
Fallback to Open-Meteo (https://api.open-meteo.com)
    ↓
Calculate OperationStatus for each hour
    ↓
Save to SQLite forecasts table
    ↓
Return JSON to React frontend
    ↓
Render table + charts
    ↓
Auto-refresh at :00 of each hour
```

---

## Operation Status Logic

| Score | Status |
|-------|--------|
| 0-19  | 🟢 Aman |
| 20-59 | 🟡 Waspada |
| 60-99 | 🔴 Risiko Tinggi |
| 100+  | ⛔ Tidak Direkomendasikan |

Score contributors:
- Rainfall ≥ 50mm/h → +100
- Rainfall ≥ 20mm/h → +70
- Rainfall ≥ 5mm/h → +40
- Rainfall > 0.5mm → +20
- Rain probability ≥ 80% → +40
- Rain probability ≥ 50% → +20
- Wind ≥ 50 km/h → +100
- Wind ≥ 35 km/h → +60
- Wind ≥ 25 km/h → +20
- Visibility < 0.5 km → +80
- Visibility < 1 km → +50
- Visibility < 3 km → +20
- Thunder/storm condition → +100

---

## Troubleshooting Build Issues

### Error: `VCRUNTIME140.dll not found`
Install Visual C++ Redistributable 2022:
https://aka.ms/vs/17/release/vc_redist.x64.exe

### Error: `error[E0433]: failed to resolve`
```powershell
rustup update stable
cargo clean
npm run tauri build
```

### Error: WebView2 not found
```powershell
# Download WebView2 bootstrap:
# https://go.microsoft.com/fwlink/p/?LinkId=2124703
```

### NSIS installer not generated
Ensure NSIS is available (Tauri bundles it automatically).
Check: `src-tauri/target/release/bundle/nsis/`

---

## Customization

### Change App Name
Edit `src-tauri/tauri.conf.json`:
```json
"package": { "productName": "YourAppName" }
```

### Change Default Theme
Edit `src-tauri/src/main.rs`, find default_settings:
```rust
("theme", "dark"),  // or "light" or "system"
```

### Change Refresh Interval
Edit `src/components/pages/MonitoringPage.tsx`.
Currently refreshes at top of each hour.

### Add Custom Operation Status Thresholds
Edit `src-tauri/src/weather.rs` → `calculate_operation_status()`
