// src-tauri/src/database.rs
// MineCast Database Engine - SQLite via rusqlite (bundled)

use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc, Local, NaiveDate};
use once_cell::sync::Mutex;
use std::sync::Arc;

pub type DbConn = Arc<Mutex<Connection>>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Location {
    pub id: Option<i64>,
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub region: Option<String>,
    pub province: Option<String>,
    pub country: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForecastRecord {
    pub id: Option<i64>,
    pub location_id: i64,
    pub forecast_date: String,
    pub forecast_hour: i32,
    pub fetched_at: String,
    pub temperature: f64,
    pub rainfall: f64,
    pub rain_probability: f64,
    pub weather_condition: String,
    pub weather_code: i32,
    pub wind_speed: f64,
    pub wind_direction: i32,
    pub wind_direction_label: String,
    pub humidity: f64,
    pub visibility: f64,
    pub pressure: f64,
    pub data_source: String,
    pub operation_status: String,
    pub operation_reasons: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActualRecord {
    pub id: Option<i64>,
    pub location_id: i64,
    pub record_date: String,
    pub record_hour: i32,
    pub is_raining: bool,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccuracyRecord {
    pub id: Option<i64>,
    pub location_id: i64,
    pub record_date: String,
    pub record_hour: i32,
    pub forecast_rain_prob: f64,
    pub forecast_rainfall: f64,
    pub actual_is_raining: bool,
    pub is_accurate: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyStats {
    pub date: String,
    pub accuracy_percent: f64,
    pub total_forecasts: i64,
    pub correct_forecasts: i64,
    pub rainy_hours: i64,
    pub dry_hours: i64,
    pub total_rainfall: f64,
    pub max_rainfall: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlyStats {
    pub year_month: String,
    pub accuracy_percent: f64,
    pub rainy_days: i64,
    pub dry_days: i64,
    pub total_rainfall: f64,
    pub max_rainfall: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub key: String,
    pub value: String,
}

pub fn init_database(db_path: &PathBuf) -> Result<DbConn> {
    let conn = Connection::open(db_path)?;

    // Performance pragmas
    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = 10000;
        PRAGMA foreign_keys = ON;
        PRAGMA temp_store = MEMORY;
        PRAGMA mmap_size = 30000000;
    ")?;

    // Create all tables
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            region TEXT,
            province TEXT,
            country TEXT NOT NULL DEFAULT 'Indonesia',
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL,
            forecast_date TEXT NOT NULL,
            forecast_hour INTEGER NOT NULL,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            temperature REAL NOT NULL DEFAULT 0,
            rainfall REAL NOT NULL DEFAULT 0,
            rain_probability REAL NOT NULL DEFAULT 0,
            weather_condition TEXT NOT NULL DEFAULT '',
            weather_code INTEGER NOT NULL DEFAULT 0,
            wind_speed REAL NOT NULL DEFAULT 0,
            wind_direction INTEGER NOT NULL DEFAULT 0,
            wind_direction_label TEXT NOT NULL DEFAULT 'N',
            humidity REAL NOT NULL DEFAULT 0,
            visibility REAL NOT NULL DEFAULT 10,
            pressure REAL NOT NULL DEFAULT 1013,
            data_source TEXT NOT NULL DEFAULT 'BMKG',
            operation_status TEXT NOT NULL DEFAULT 'AMAN',
            operation_reasons TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE(location_id, forecast_date, forecast_hour)
        );

        CREATE TABLE IF NOT EXISTS actuals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL,
            record_date TEXT NOT NULL,
            record_hour INTEGER NOT NULL,
            is_raining INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE(location_id, record_date, record_hour)
        );

        CREATE TABLE IF NOT EXISTS accuracy (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL,
            record_date TEXT NOT NULL,
            record_hour INTEGER NOT NULL,
            forecast_rain_prob REAL NOT NULL DEFAULT 0,
            forecast_rainfall REAL NOT NULL DEFAULT 0,
            actual_is_raining INTEGER NOT NULL DEFAULT 0,
            is_accurate INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE(location_id, record_date, record_hour)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL DEFAULT 'INFO',
            category TEXT NOT NULL DEFAULT 'GENERAL',
            message TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasts(location_id, forecast_date);
        CREATE INDEX IF NOT EXISTS idx_actuals_date ON actuals(location_id, record_date);
        CREATE INDEX IF NOT EXISTS idx_accuracy_date ON accuracy(location_id, record_date);
        CREATE INDEX IF NOT EXISTS idx_log_date ON activity_log(created_at);
    ")?;

    // Insert default settings
    let default_settings = vec![
        ("theme", "system"),
        ("log_retention_days", "7"),
        ("auto_refresh", "true"),
        ("last_location_id", ""),
        ("backup_path", ""),
        ("export_path", ""),
    ];

    for (key, value) in default_settings {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
    }

    Ok(Arc::new(Mutex::new(conn)))
}

// ---- Location Operations ----

pub fn save_location(conn: &DbConn, location: &Location) -> Result<i64> {
    let db = conn.lock().unwrap();

    // Deactivate all
    db.execute("UPDATE locations SET is_active = 0", [])?;

    // Upsert location
    let existing: Result<i64> = db.query_row(
        "SELECT id FROM locations WHERE ABS(lat - ?1) < 0.01 AND ABS(lon - ?2) < 0.01",
        params![location.lat, location.lon],
        |row| row.get(0),
    );

    let id = match existing {
        Ok(id) => {
            db.execute(
                "UPDATE locations SET name=?1, region=?2, province=?3, is_active=1 WHERE id=?4",
                params![location.name, location.region, location.province, id],
            )?;
            id
        }
        Err(_) => {
            db.execute(
                "INSERT INTO locations (name, lat, lon, region, province, country, is_active) VALUES (?1,?2,?3,?4,?5,?6,1)",
                params![location.name, location.lat, location.lon, location.region, location.province, location.country],
            )?;
            db.last_insert_rowid()
        }
    };

    // Update setting
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_location_id', ?1)",
        params![id.to_string()],
    )?;

    Ok(id)
}

pub fn get_active_location(conn: &DbConn) -> Option<Location> {
    let db = conn.lock().unwrap();
    db.query_row(
        "SELECT id, name, lat, lon, region, province, country, is_active, created_at FROM locations WHERE is_active = 1 LIMIT 1",
        [],
        |row| Ok(Location {
            id: row.get(0)?,
            name: row.get(1)?,
            lat: row.get(2)?,
            lon: row.get(3)?,
            region: row.get(4)?,
            province: row.get(5)?,
            country: row.get(6)?,
            is_active: row.get::<_, i32>(7)? == 1,
            created_at: row.get(8)?,
        }),
    ).ok()
}

pub fn get_all_locations(conn: &DbConn) -> Vec<Location> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, name, lat, lon, region, province, country, is_active, created_at FROM locations ORDER BY created_at DESC"
    ).unwrap();
    stmt.query_map([], |row| Ok(Location {
        id: row.get(0)?,
        name: row.get(1)?,
        lat: row.get(2)?,
        lon: row.get(3)?,
        region: row.get(4)?,
        province: row.get(5)?,
        country: row.get(6)?,
        is_active: row.get::<_, i32>(7)? == 1,
        created_at: row.get(8)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

// ---- Forecast Operations ----

pub fn save_forecasts(conn: &DbConn, forecasts: &[ForecastRecord]) -> Result<()> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare("
        INSERT OR REPLACE INTO forecasts
        (location_id, forecast_date, forecast_hour, fetched_at, temperature, rainfall, rain_probability,
         weather_condition, weather_code, wind_speed, wind_direction, wind_direction_label,
         humidity, visibility, pressure, data_source, operation_status, operation_reasons)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)
    ")?;

    for f in forecasts {
        stmt.execute(params![
            f.location_id, f.forecast_date, f.forecast_hour, f.fetched_at,
            f.temperature, f.rainfall, f.rain_probability,
            f.weather_condition, f.weather_code, f.wind_speed, f.wind_direction,
            f.wind_direction_label, f.humidity, f.visibility, f.pressure,
            f.data_source, f.operation_status, f.operation_reasons
        ])?;
    }
    Ok(())
}

pub fn get_forecasts_for_date(conn: &DbConn, location_id: i64, date: &str) -> Vec<ForecastRecord> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare("
        SELECT id, location_id, forecast_date, forecast_hour, fetched_at,
               temperature, rainfall, rain_probability, weather_condition, weather_code,
               wind_speed, wind_direction, wind_direction_label, humidity, visibility,
               pressure, data_source, operation_status, operation_reasons
        FROM forecasts
        WHERE location_id = ?1 AND forecast_date = ?2
        ORDER BY forecast_hour ASC
    ").unwrap();

    stmt.query_map(params![location_id, date], |row| Ok(ForecastRecord {
        id: row.get(0)?,
        location_id: row.get(1)?,
        forecast_date: row.get(2)?,
        forecast_hour: row.get(3)?,
        fetched_at: row.get(4)?,
        temperature: row.get(5)?,
        rainfall: row.get(6)?,
        rain_probability: row.get(7)?,
        weather_condition: row.get(8)?,
        weather_code: row.get(9)?,
        wind_speed: row.get(10)?,
        wind_direction: row.get(11)?,
        wind_direction_label: row.get(12)?,
        humidity: row.get(13)?,
        visibility: row.get(14)?,
        pressure: row.get(15)?,
        data_source: row.get(16)?,
        operation_status: row.get(17)?,
        operation_reasons: row.get(18)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

pub fn get_forecasts_range(conn: &DbConn, location_id: i64, start: &str, end: &str) -> Vec<ForecastRecord> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare("
        SELECT id, location_id, forecast_date, forecast_hour, fetched_at,
               temperature, rainfall, rain_probability, weather_condition, weather_code,
               wind_speed, wind_direction, wind_direction_label, humidity, visibility,
               pressure, data_source, operation_status, operation_reasons
        FROM forecasts
        WHERE location_id = ?1 AND forecast_date >= ?2 AND forecast_date <= ?3
        ORDER BY forecast_date ASC, forecast_hour ASC
    ").unwrap();

    stmt.query_map(params![location_id, start, end], |row| Ok(ForecastRecord {
        id: row.get(0)?,
        location_id: row.get(1)?,
        forecast_date: row.get(2)?,
        forecast_hour: row.get(3)?,
        fetched_at: row.get(4)?,
        temperature: row.get(5)?,
        rainfall: row.get(6)?,
        rain_probability: row.get(7)?,
        weather_condition: row.get(8)?,
        weather_code: row.get(9)?,
        wind_speed: row.get(10)?,
        wind_direction: row.get(11)?,
        wind_direction_label: row.get(12)?,
        humidity: row.get(13)?,
        visibility: row.get(14)?,
        pressure: row.get(15)?,
        data_source: row.get(16)?,
        operation_status: row.get(17)?,
        operation_reasons: row.get(18)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

// ---- Actual Data Operations ----

pub fn save_actual(conn: &DbConn, actual: &ActualRecord) -> Result<()> {
    let db = conn.lock().unwrap();
    db.execute("
        INSERT OR REPLACE INTO actuals (location_id, record_date, record_hour, is_raining, notes)
        VALUES (?1, ?2, ?3, ?4, ?5)
    ", params![
        actual.location_id, actual.record_date, actual.record_hour,
        actual.is_raining as i32, actual.notes
    ])?;
    Ok(())
}

pub fn get_actuals_for_date(conn: &DbConn, location_id: i64, date: &str) -> Vec<ActualRecord> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare("
        SELECT id, location_id, record_date, record_hour, is_raining, notes, created_at
        FROM actuals WHERE location_id = ?1 AND record_date = ?2
        ORDER BY record_hour ASC
    ").unwrap();

    stmt.query_map(params![location_id, date], |row| Ok(ActualRecord {
        id: row.get(0)?,
        location_id: row.get(1)?,
        record_date: row.get(2)?,
        record_hour: row.get(3)?,
        is_raining: row.get::<_, i32>(4)? == 1,
        notes: row.get(5)?,
        created_at: row.get(6)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

// ---- Accuracy Operations ----

pub fn calculate_and_save_accuracy(conn: &DbConn, location_id: i64, date: &str) -> Result<()> {
    let forecasts = get_forecasts_for_date(conn, location_id, date);
    let actuals = get_actuals_for_date(conn, location_id, date);

    let db = conn.lock().unwrap();

    for actual in &actuals {
        if let Some(forecast) = forecasts.iter().find(|f| f.forecast_hour == actual.record_hour) {
            let forecast_predicts_rain = forecast.rain_probability >= 50.0 || forecast.rainfall > 0.5;
            let is_accurate = forecast_predicts_rain == actual.is_raining;

            db.execute("
                INSERT OR REPLACE INTO accuracy
                (location_id, record_date, record_hour, forecast_rain_prob, forecast_rainfall, actual_is_raining, is_accurate)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ", params![
                location_id, actual.record_date, actual.record_hour,
                forecast.rain_probability, forecast.rainfall,
                actual.is_raining as i32, is_accurate as i32
            ])?;
        }
    }
    Ok(())
}

pub fn get_daily_stats(conn: &DbConn, location_id: i64, date: &str) -> Option<DailyStats> {
    let db = conn.lock().unwrap();
    let result = db.query_row("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) as correct,
            SUM(CASE WHEN actual_is_raining = 1 THEN 1 ELSE 0 END) as rainy,
            SUM(CASE WHEN actual_is_raining = 0 THEN 1 ELSE 0 END) as dry
        FROM accuracy WHERE location_id = ?1 AND record_date = ?2
    ", params![location_id, date], |row| {
        let total: i64 = row.get(0)?;
        let correct: i64 = row.get(1)?;
        Ok((total, correct, row.get::<_,i64>(2)?, row.get::<_,i64>(3)?))
    }).ok();

    let rainfall_stats: Option<(f64, f64)> = db.query_row("
        SELECT COALESCE(SUM(rainfall), 0), COALESCE(MAX(rainfall), 0)
        FROM forecasts WHERE location_id = ?1 AND forecast_date = ?2
    ", params![location_id, date], |row| {
        Ok((row.get::<_,f64>(0)?, row.get::<_,f64>(1)?))
    }).ok();

    if let (Some((total, correct, rainy, dry)), Some((total_rf, max_rf))) = (result, rainfall_stats) {
        let accuracy = if total > 0 { (correct as f64 / total as f64) * 100.0 } else { 0.0 };
        Some(DailyStats {
            date: date.to_string(),
            accuracy_percent: accuracy,
            total_forecasts: total,
            correct_forecasts: correct,
            rainy_hours: rainy,
            dry_hours: dry,
            total_rainfall: total_rf,
            max_rainfall: max_rf,
        })
    } else {
        None
    }
}

pub fn get_monthly_stats(conn: &DbConn, location_id: i64, year: i32, month: u32) -> MonthlyStats {
    let year_month = format!("{:04}-{:02}", year, month);
    let db = conn.lock().unwrap();

    let acc = db.query_row("
        SELECT COUNT(*), SUM(CASE WHEN is_accurate=1 THEN 1 ELSE 0 END)
        FROM accuracy WHERE location_id=?1 AND record_date LIKE ?2
    ", params![location_id, format!("{}%", year_month)], |row| {
        Ok((row.get::<_,i64>(0)?, row.get::<_,i64>(1)?))
    }).unwrap_or((0, 0));

    let rainfall = db.query_row("
        SELECT COALESCE(SUM(rainfall), 0), COALESCE(MAX(rainfall), 0)
        FROM forecasts WHERE location_id=?1 AND forecast_date LIKE ?2
    ", params![location_id, format!("{}%", year_month)], |row| {
        Ok((row.get::<_,f64>(0)?, row.get::<_,f64>(1)?))
    }).unwrap_or((0.0, 0.0));

    // Count distinct rainy/dry days
    let rainy_days: i64 = db.query_row("
        SELECT COUNT(DISTINCT record_date) FROM accuracy
        WHERE location_id=?1 AND record_date LIKE ?2
        AND actual_is_raining=1
    ", params![location_id, format!("{}%", year_month)], |row| row.get(0)).unwrap_or(0);

    let total_days: i64 = db.query_row("
        SELECT COUNT(DISTINCT record_date) FROM accuracy
        WHERE location_id=?1 AND record_date LIKE ?2
    ", params![location_id, format!("{}%", year_month)], |row| row.get(0)).unwrap_or(0);

    let accuracy = if acc.0 > 0 { (acc.1 as f64 / acc.0 as f64) * 100.0 } else { 0.0 };

    MonthlyStats {
        year_month,
        accuracy_percent: accuracy,
        rainy_days,
        dry_days: total_days - rainy_days,
        total_rainfall: rainfall.0,
        max_rainfall: rainfall.1,
    }
}

pub fn get_yearly_stats(conn: &DbConn, location_id: i64, year: i32) -> Vec<MonthlyStats> {
    (1..=12).map(|m| get_monthly_stats(conn, location_id, year, m)).collect()
}

// ---- Settings Operations ----

pub fn get_setting(conn: &DbConn, key: &str) -> Option<String> {
    let db = conn.lock().unwrap();
    db.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    ).ok()
}

pub fn set_setting(conn: &DbConn, key: &str, value: &str) -> Result<()> {
    let db = conn.lock().unwrap();
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &DbConn) -> Vec<AppSettings> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare("SELECT key, value FROM settings").unwrap();
    stmt.query_map([], |row| Ok(AppSettings {
        key: row.get(0)?,
        value: row.get(1)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

// ---- Logging ----

pub fn log_activity(conn: &DbConn, level: &str, category: &str, message: &str, detail: Option<&str>) {
    let db = conn.lock().unwrap();
    let _ = db.execute(
        "INSERT INTO activity_log (level, category, message, detail) VALUES (?1, ?2, ?3, ?4)",
        params![level, category, message, detail],
    );
}

pub fn cleanup_logs(conn: &DbConn, retention_days: i64) {
    if retention_days <= 0 { return; }
    let db = conn.lock().unwrap();
    let _ = db.execute(
        "DELETE FROM activity_log WHERE created_at < datetime('now', ?1)",
        params![format!("-{} days", retention_days)],
    );
}

pub fn get_logs(conn: &DbConn, limit: i64) -> Vec<serde_json::Value> {
    let db = conn.lock().unwrap();
    let mut stmt = db.prepare("
        SELECT id, level, category, message, detail, created_at
        FROM activity_log ORDER BY created_at DESC LIMIT ?1
    ").unwrap();

    stmt.query_map(params![limit], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,i64>(0)?,
            "level": row.get::<_,String>(1)?,
            "category": row.get::<_,String>(2)?,
            "message": row.get::<_,String>(3)?,
            "detail": row.get::<_,Option<String>>(4)?,
            "created_at": row.get::<_,String>(5)?
        }))
    }).unwrap().filter_map(|r| r.ok()).collect()
}

// ---- Database Reset ----

pub fn reset_database(conn: &DbConn) -> Result<()> {
    let db = conn.lock().unwrap();
    db.execute_batch("
        DELETE FROM accuracy;
        DELETE FROM actuals;
        DELETE FROM forecasts;
        DELETE FROM locations;
        DELETE FROM activity_log;
        DELETE FROM settings;
        INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'system');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('log_retention_days', '7');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_refresh', 'true');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('last_location_id', '');
    ")?;
    Ok(())
}
