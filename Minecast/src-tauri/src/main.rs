// src-tauri/src/main.rs
// MineCast - Tauri Backend Entry Point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod weather;
mod export;

use database::*;
use weather::*;
use tauri::{State, Manager, AppHandle};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Local;
use once_cell::sync::OnceCell;
use std::fs;
use zip::{write::FileOptions, ZipWriter};
use std::io::Write;

// ---- App State ----

struct AppState {
    db: DbConn,
    app_dir: PathBuf,
    backup_dir: PathBuf,
    export_dir: PathBuf,
    log_dir: PathBuf,
}

type TauriState<'a> = State<'a, AppState>;

// ---- Helpers ----

fn ensure_dir(path: &PathBuf) {
    if let Err(e) = fs::create_dir_all(path) {
        eprintln!("Failed to create directory {:?}: {}", path, e);
    }
}

fn write_text_file(path: &PathBuf, content: &str) {
    if !path.exists() {
        let _ = fs::write(path, content);
    }
}

fn init_docs(app_dir: &PathBuf) {
    let readme = r#"MineCast v1.0.0 - Monitoring Cuaca Operasional Pertambangan Batu Bara
======================================================================

TENTANG APLIKASI
MineCast adalah aplikasi desktop profesional untuk monitoring cuaca
operasional pertambangan batu bara. Menggunakan data dari BMKG sebagai
sumber utama dan Open-Meteo sebagai fallback.

FITUR UTAMA
- Monitoring cuaca 24 jam ke depan per jam
- Status operasi cerdas (Aman / Waspada / Risiko Tinggi / Tidak Direkomendasikan)
- Database histori lokal berbasis SQLite
- Statistik akurasi forecast
- Export ke Excel
- Backup otomatis database
- Dark Mode / Light Mode / Ikuti Windows

CARA PENGGUNAAN
1. Buka aplikasi MineCast
2. Pergi ke Pengaturan untuk mengatur lokasi pertama kali
3. Cari nama daerah tambang Anda
4. Pilih lokasi yang tepat dari hasil pencarian
5. Kembali ke Monitoring Harian untuk melihat forecast

LOKASI DATA
- Database    : %APPDATA%\MineCast\minecast.db
- Backup      : %APPDATA%\MineCast\Backup\
- Export      : %APPDATA%\MineCast\Export\
- Log         : %APPDATA%\MineCast\Logs\

SUMBER DATA
- BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) - Utama
- Open-Meteo - Fallback & Pelengkap

REFRESH DATA
- Otomatis setiap pergantian jam
- Tombol "Refresh Sekarang" tersedia di Monitoring Harian

SUPPORT
Untuk bantuan teknis, lihat TROUBLESHOOTING.txt
"#;

    let changelog = r#"MineCast CHANGELOG
==================

v1.0.0 (2024)
- Rilis pertama MineCast
- Monitoring cuaca 24 jam dari BMKG + Open-Meteo
- Status operasi cerdas 4 level
- Input aktual per jam untuk kalkulasi akurasi
- Database histori SQLite
- Statistik akurasi harian/bulanan/tahunan
- Export Excel (harian & rentang tanggal)
- Backup database otomatis
- Dark Mode / Light Mode / Ikuti Windows
- Log aktivitas dengan retensi konfigurabel
- NSIS Installer untuk Windows 10/11
"#;

    let troubleshooting = r#"MineCast TROUBLESHOOTING
=========================

MASALAH: Data cuaca tidak muncul
SOLUSI:
1. Pastikan koneksi internet aktif
2. Klik tombol "Refresh Sekarang"
3. Pastikan lokasi sudah diatur di Pengaturan
4. Coba cari ulang lokasi

MASALAH: Lokasi tidak ditemukan
SOLUSI:
1. Coba nama kota/kabupaten yang berbeda
2. Gunakan nama dalam Bahasa Indonesia
3. Contoh: "Kutai Kartanegara", "Samarinda", "Balikpapan"

MASALAH: Aplikasi lambat saat startup
SOLUSI:
1. Pastikan tidak ada antivirus yang memblokir
2. Tambahkan folder instalasi ke whitelist antivirus
3. Coba restart komputer

MASALAH: Export Excel gagal
SOLUSI:
1. Pastikan folder Export dapat ditulis
2. Tutup file Excel yang mungkin masih terbuka
3. Cek ruang disk tersisa

MASALAH: Database corrupt
SOLUSI:
1. Pergi ke Pengaturan > Backup
2. Restore dari backup terakhir
3. Atau gunakan Reset Database (DATA AKAN HILANG)

MASALAH: Koneksi BMKG gagal
SOLUSI:
MineCast akan otomatis menggunakan Open-Meteo sebagai fallback.
Data tetap tersedia meskipun BMKG tidak dapat diakses.

LOG APLIKASI
Lihat folder Logs untuk detail error yang lebih lengkap.
"#;

    write_text_file(&app_dir.join("README.txt"), readme);
    write_text_file(&app_dir.join("CHANGELOG.txt"), changelog);
    write_text_file(&app_dir.join("TROUBLESHOOTING.txt"), troubleshooting);
}

// ---- Tauri Commands ----

#[tauri::command]
async fn cmd_search_location(query: String) -> Result<Vec<LocationResult>, String> {
    search_location(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_save_location(
    state: TauriState<'_>,
    location: Location,
) -> Result<i64, String> {
    let id = save_location(&state.db, &location).map_err(|e| e.to_string())?;
    log_activity(&state.db, "INFO", "LOCATION", &format!("Lokasi disimpan: {}", location.name), None);
    Ok(id)
}

#[tauri::command]
fn cmd_get_active_location(state: TauriState<'_>) -> Option<Location> {
    get_active_location(&state.db)
}

#[tauri::command]
fn cmd_get_all_locations(state: TauriState<'_>) -> Vec<Location> {
    get_all_locations(&state.db)
}

#[tauri::command]
async fn cmd_fetch_weather(
    state: TauriState<'_>,
    lat: f64,
    lon: f64,
    location_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let weather_data = fetch_weather(lat, lon).await.map_err(|e| {
        log_activity(&state.db, "ERROR", "WEATHER", "Gagal mengambil data cuaca", Some(&e.to_string()));
        e.to_string()
    })?;

    // Calculate operation status and save to DB
    let mut forecasts = Vec::new();
    let mut result_json = Vec::new();

    for w in &weather_data {
        let op = calculate_operation_status(w);
        let reasons_json = serde_json::to_string(&op.reasons).unwrap_or_default();

        let forecast = ForecastRecord {
            id: None,
            location_id,
            forecast_date: w.date.clone(),
            forecast_hour: w.hour,
            fetched_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            temperature: w.temperature,
            rainfall: w.rainfall,
            rain_probability: w.rain_probability,
            weather_condition: w.weather_condition.clone(),
            weather_code: w.weather_code,
            wind_speed: w.wind_speed,
            wind_direction: w.wind_direction,
            wind_direction_label: w.wind_direction_label.clone(),
            humidity: w.humidity,
            visibility: w.visibility,
            pressure: w.pressure,
            data_source: w.data_source.clone(),
            operation_status: op.status_code.clone(),
            operation_reasons: reasons_json,
        };

        result_json.push(serde_json::json!({
            "date": w.date,
            "hour": w.hour,
            "temperature": w.temperature,
            "rainfall": w.rainfall,
            "rain_probability": w.rain_probability,
            "weather_condition": w.weather_condition,
            "weather_code": w.weather_code,
            "wind_speed": w.wind_speed,
            "wind_direction": w.wind_direction,
            "wind_direction_label": w.wind_direction_label,
            "humidity": w.humidity,
            "visibility": w.visibility,
            "pressure": w.pressure,
            "data_source": w.data_source,
            "operation_status": op.status_code,
            "operation_status_label": op.status,
            "operation_color": op.color,
            "operation_reasons": op.reasons,
        }));

        forecasts.push(forecast);
    }

    // Save to DB
    let _ = save_forecasts(&state.db, &forecasts);
    log_activity(&state.db, "INFO", "WEATHER", &format!("Data cuaca diperbarui: {} jam", forecasts.len()), None);

    Ok(result_json)
}

#[tauri::command]
fn cmd_get_forecasts_date(
    state: TauriState<'_>,
    location_id: i64,
    date: String,
) -> Vec<ForecastRecord> {
    get_forecasts_for_date(&state.db, location_id, &date)
}

#[tauri::command]
fn cmd_get_forecasts_range(
    state: TauriState<'_>,
    location_id: i64,
    start: String,
    end: String,
) -> Vec<ForecastRecord> {
    get_forecasts_range(&state.db, location_id, &start, &end)
}

#[tauri::command]
fn cmd_save_actual(
    state: TauriState<'_>,
    actual: ActualRecord,
) -> Result<(), String> {
    save_actual(&state.db, &actual).map_err(|e| e.to_string())?;
    let _ = calculate_and_save_accuracy(&state.db, actual.location_id, &actual.record_date);
    log_activity(&state.db, "INFO", "ACTUAL", 
        &format!("Data aktual disimpan: {} jam {:02}:00 - {}", 
            actual.record_date, actual.record_hour, 
            if actual.is_raining { "Hujan" } else { "Tidak Hujan" }), None);
    Ok(())
}

#[tauri::command]
fn cmd_get_actuals_date(
    state: TauriState<'_>,
    location_id: i64,
    date: String,
) -> Vec<ActualRecord> {
    get_actuals_for_date(&state.db, location_id, &date)
}

#[tauri::command]
fn cmd_get_daily_stats(
    state: TauriState<'_>,
    location_id: i64,
    date: String,
) -> Option<DailyStats> {
    get_daily_stats(&state.db, location_id, &date)
}

#[tauri::command]
fn cmd_get_monthly_stats(
    state: TauriState<'_>,
    location_id: i64,
    year: i32,
    month: u32,
) -> MonthlyStats {
    get_monthly_stats(&state.db, location_id, year, month)
}

#[tauri::command]
fn cmd_get_yearly_stats(
    state: TauriState<'_>,
    location_id: i64,
    year: i32,
) -> Vec<MonthlyStats> {
    get_yearly_stats(&state.db, location_id, year)
}

#[tauri::command]
fn cmd_get_setting(state: TauriState<'_>, key: String) -> Option<String> {
    get_setting(&state.db, &key)
}

#[tauri::command]
fn cmd_set_setting(state: TauriState<'_>, key: String, value: String) -> Result<(), String> {
    set_setting(&state.db, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_get_all_settings(state: TauriState<'_>) -> Vec<AppSettings> {
    get_all_settings(&state.db)
}

#[tauri::command]
fn cmd_get_logs(state: TauriState<'_>, limit: i64) -> Vec<serde_json::Value> {
    get_logs(&state.db, limit)
}

#[tauri::command]
fn cmd_cleanup_logs(state: TauriState<'_>, retention_days: i64) {
    cleanup_logs(&state.db, retention_days);
}

#[tauri::command]
async fn cmd_export_daily(
    state: TauriState<'_>,
    location_id: i64,
    location_name: String,
    date: String,
) -> Result<String, String> {
    let path = export::export_daily(
        &state.db, location_id, &location_name, &date, &state.export_dir
    ).map_err(|e| {
        log_activity(&state.db, "ERROR", "EXPORT", "Gagal export Excel harian", Some(&e.to_string()));
        e.to_string()
    })?;
    log_activity(&state.db, "INFO", "EXPORT", &format!("Export Excel harian: {}", date), None);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn cmd_export_range(
    state: TauriState<'_>,
    location_id: i64,
    location_name: String,
    start_date: String,
    end_date: String,
) -> Result<String, String> {
    let path = export::export_range(
        &state.db, location_id, &location_name, &start_date, &end_date, &state.export_dir
    ).map_err(|e| {
        log_activity(&state.db, "ERROR", "EXPORT", "Gagal export Excel range", Some(&e.to_string()));
        e.to_string()
    })?;
    log_activity(&state.db, "INFO", "EXPORT", &format!("Export Excel range: {} - {}", start_date, end_date), None);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn cmd_backup_database(state: TauriState<'_>) -> Result<String, String> {
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_file = state.backup_dir.join(format!("minecast_backup_{}.zip", timestamp));

    let db_path = state.app_dir.join("minecast.db");
    if !db_path.exists() {
        return Err("Database file tidak ditemukan".to_string());
    }

    let file = fs::File::create(&backup_file).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    zip.start_file("minecast.db", options).map_err(|e| e.to_string())?;
    let db_data = fs::read(&db_path).map_err(|e| e.to_string())?;
    zip.write_all(&db_data).map_err(|e| e.to_string())?;
    zip.finish().map_err(|e| e.to_string())?;

    log_activity(&state.db, "INFO", "BACKUP", &format!("Backup dibuat: {}", backup_file.display()), None);
    Ok(backup_file.to_string_lossy().to_string())
}

#[tauri::command]
fn cmd_reset_database(state: TauriState<'_>) -> Result<(), String> {
    // Auto-backup before reset
    let _ = cmd_backup_database(state.inner().into());
    reset_database(&state.db).map_err(|e| e.to_string())?;
    log_activity(&state.db, "WARN", "DATABASE", "Database direset", None);
    Ok(())
}

#[tauri::command]
fn cmd_get_paths(state: TauriState<'_>) -> serde_json::Value {
    serde_json::json!({
        "app_dir": state.app_dir.to_string_lossy(),
        "backup_dir": state.backup_dir.to_string_lossy(),
        "export_dir": state.export_dir.to_string_lossy(),
        "log_dir": state.log_dir.to_string_lossy(),
    })
}

#[tauri::command]
fn cmd_open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn cmd_open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn cmd_get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn cmd_write_log_file(state: TauriState<'_>, message: String, level: String) {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let log_file = state.log_dir.join(format!("minecast_{}.log", today));
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let line = format!("[{}] [{}] {}\n", timestamp, level, message);
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .and_then(|mut f| { use std::io::Write; f.write_all(line.as_bytes()) });
    log_activity(&state.db, &level, "APP", &message, None);
}

// ---- Main ----

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path_resolver()
                .app_data_dir()
                .expect("Failed to get app data dir");

            let backup_dir = app_dir.join("Backup");
            let export_dir = app_dir.join("Export");
            let log_dir = app_dir.join("Logs");

            ensure_dir(&app_dir);
            ensure_dir(&backup_dir);
            ensure_dir(&export_dir);
            ensure_dir(&log_dir);

            init_docs(&app_dir);

            let db_path = app_dir.join("minecast.db");
            let db = init_database(&db_path).expect("Failed to initialize database");

            log_activity(&db, "INFO", "APP", "MineCast dimulai", Some(&format!("v{}", env!("CARGO_PKG_VERSION"))));

            // Auto cleanup logs based on retention setting
            let retention: i64 = get_setting(&db, "log_retention_days")
                .and_then(|v| v.parse().ok())
                .unwrap_or(7);
            if retention > 0 {
                cleanup_logs(&db, retention);
            }

            app.manage(AppState {
                db,
                app_dir,
                backup_dir,
                export_dir,
                log_dir,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_search_location,
            cmd_save_location,
            cmd_get_active_location,
            cmd_get_all_locations,
            cmd_fetch_weather,
            cmd_get_forecasts_date,
            cmd_get_forecasts_range,
            cmd_save_actual,
            cmd_get_actuals_date,
            cmd_get_daily_stats,
            cmd_get_monthly_stats,
            cmd_get_yearly_stats,
            cmd_get_setting,
            cmd_set_setting,
            cmd_get_all_settings,
            cmd_get_logs,
            cmd_cleanup_logs,
            cmd_export_daily,
            cmd_export_range,
            cmd_backup_database,
            cmd_reset_database,
            cmd_get_paths,
            cmd_open_folder,
            cmd_open_file,
            cmd_get_app_version,
            cmd_write_log_file,
        ])
        .run(tauri::generate_context!())
        .expect("Error running MineCast");
}
