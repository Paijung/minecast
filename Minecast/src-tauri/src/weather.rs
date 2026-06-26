// src-tauri/src/weather.rs
// MineCast Weather Service - BMKG primary + Open-Meteo fallback

use serde::{Deserialize, Serialize};
use reqwest::Client;
use anyhow::{Result, anyhow};
use chrono::{Local, NaiveDate, Datelike, Timelike};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeatherData {
    pub datetime: String,
    pub date: String,
    pub hour: i32,
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationResult {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub region: Option<String>,
    pub province: Option<String>,
    pub country: String,
    pub display_name: String,
}

// ---- Open-Meteo geocoding response ----
#[derive(Deserialize)]
struct GeocodingResponse {
    results: Option<Vec<GeocodingResult>>,
}

#[derive(Deserialize)]
struct GeocodingResult {
    name: String,
    latitude: f64,
    longitude: f64,
    #[serde(default)]
    admin1: Option<String>,
    #[serde(default)]
    admin2: Option<String>,
    #[serde(default)]
    country: Option<String>,
}

// ---- Open-Meteo forecast response ----
#[derive(Deserialize)]
struct OpenMeteoResponse {
    hourly: OpenMeteoHourly,
}

#[derive(Deserialize)]
struct OpenMeteoHourly {
    time: Vec<String>,
    temperature_2m: Vec<Option<f64>>,
    precipitation: Vec<Option<f64>>,
    precipitation_probability: Vec<Option<f64>>,
    weathercode: Vec<Option<i32>>,
    windspeed_10m: Vec<Option<f64>>,
    winddirection_10m: Vec<Option<f64>>,
    relativehumidity_2m: Vec<Option<f64>>,
    visibility: Vec<Option<f64>>,
    surface_pressure: Vec<Option<f64>>,
}

// ---- BMKG response structures ----
#[derive(Deserialize, Debug)]
struct BmkgForecastResponse {
    data: Vec<BmkgLocation>,
}

#[derive(Deserialize, Debug)]
struct BmkgLocation {
    #[serde(rename = "lokasi")]
    lokasi: BmkgLokasi,
    cuaca: Vec<Vec<BmkgCuacaItem>>,
}

#[derive(Deserialize, Debug)]
struct BmkgLokasi {
    kotkab: Option<String>,
    provinsi: Option<String>,
}

#[derive(Deserialize, Debug)]
struct BmkgCuacaItem {
    datetime: Option<String>,
    #[serde(rename = "t")]
    temperature: Option<f64>,
    #[serde(rename = "hu")]
    humidity: Option<f64>,
    #[serde(rename = "weather")]
    weather: Option<i32>,
    #[serde(rename = "weather_desc")]
    weather_desc: Option<String>,
    #[serde(rename = "ws")]
    wind_speed: Option<f64>,
    #[serde(rename = "wd")]
    wind_direction: Option<String>,
    #[serde(rename = "vs")]
    visibility: Option<String>,
    #[serde(rename = "tp")]
    tp: Option<f64>,
    #[serde(rename = "tcc")]
    tcc: Option<f64>,
}

pub fn degrees_to_compass(degrees: f64) -> String {
    let d = ((degrees % 360.0) + 360.0) % 360.0;
    match d as u32 {
        338..=360 | 0..=22 => "N".to_string(),
        23..=67 => "NE".to_string(),
        68..=112 => "E".to_string(),
        113..=157 => "SE".to_string(),
        158..=202 => "S".to_string(),
        203..=247 => "SW".to_string(),
        248..=292 => "W".to_string(),
        293..=337 => "NW".to_string(),
        _ => "N".to_string(),
    }
}

pub fn bmkg_wind_to_degrees(wd: &str) -> i32 {
    match wd.to_uppercase().as_str() {
        "N" | "UTARA" => 0,
        "NNE" => 22,
        "NE" | "TIMUR LAUT" => 45,
        "ENE" => 67,
        "E" | "TIMUR" => 90,
        "ESE" => 112,
        "SE" | "TENGGARA" => 135,
        "SSE" => 157,
        "S" | "SELATAN" => 180,
        "SSW" => 202,
        "SW" | "BARAT DAYA" => 225,
        "WSW" => 247,
        "W" | "BARAT" => 270,
        "WNW" => 292,
        "NW" | "BARAT LAUT" => 315,
        "NNW" => 337,
        _ => 0,
    }
}

pub fn wmo_code_to_condition(code: i32) -> String {
    match code {
        0 => "Cerah".to_string(),
        1 => "Cerah Berawan".to_string(),
        2 => "Berawan".to_string(),
        3 => "Mendung".to_string(),
        45 | 48 => "Berkabut".to_string(),
        51 | 53 | 55 => "Gerimis".to_string(),
        61 | 63 => "Hujan Sedang".to_string(),
        65 => "Hujan Lebat".to_string(),
        71 | 73 | 75 | 77 => "Hujan Es".to_string(),
        80 | 81 => "Hujan Ringan".to_string(),
        82 => "Hujan Lebat".to_string(),
        85 | 86 => "Hujan Es Lebat".to_string(),
        95 => "Badai Petir".to_string(),
        96 | 99 => "Badai Petir Lebat".to_string(),
        100 => "Cerah".to_string(),
        101 => "Cerah Berawan".to_string(),
        102 | 103 => "Berawan".to_string(),
        104 => "Mendung".to_string(),
        _ => "Tidak Diketahui".to_string(),
    }
}

pub fn bmkg_code_to_condition(code: i32) -> String {
    match code {
        0 => "Cerah".to_string(),
        1 => "Cerah Berawan".to_string(),
        2 => "Berawan".to_string(),
        3 => "Berawan Tebal".to_string(),
        4 => "Berawan Tebal".to_string(),
        5 => "Udara Kabur".to_string(),
        10 => "Asap".to_string(),
        45 => "Berkabut".to_string(),
        60 => "Hujan Ringan".to_string(),
        61 => "Hujan Ringan".to_string(),
        63 => "Hujan Sedang".to_string(),
        65 => "Hujan Lebat".to_string(),
        80 => "Hujan Lokal".to_string(),
        95 => "Hujan Petir".to_string(),
        97 => "Hujan Petir Lebat".to_string(),
        _ => "Tidak Diketahui".to_string(),
    }
}

pub fn visibility_str_to_km(vs: &str) -> f64 {
    match vs {
        ">1000" | ">10 km" => 10.0,
        "1000" => 1.0,
        "2000" => 2.0,
        "3000" => 3.0,
        "4000" => 4.0,
        "5000" => 5.0,
        "6000" => 6.0,
        "7000" => 7.0,
        "8000" => 8.0,
        "9000" => 9.0,
        "10000" => 10.0,
        _ => {
            if let Ok(m) = vs.parse::<f64>() {
                m / 1000.0
            } else {
                10.0
            }
        }
    }
}

pub async fn search_location(query: &str) -> Result<Vec<LocationResult>> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("MineCast/1.0 (Coal Mine Weather App)")
        .build()?;

    let url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=8&language=id&format=json",
        urlencoding::encode(query)
    );

    let resp = client.get(&url).send().await?;
    let geo: GeocodingResponse = resp.json().await?;

    let results = geo.results.unwrap_or_default().into_iter().map(|r| {
        let display = format!("{}{}, {}",
            r.name,
            r.admin1.as_deref().map(|a| format!(", {}", a)).unwrap_or_default(),
            r.country.as_deref().unwrap_or("Indonesia"),
        );
        LocationResult {
            name: r.name.clone(),
            lat: r.latitude,
            lon: r.longitude,
            region: r.admin2.clone(),
            province: r.admin1.clone(),
            country: r.country.unwrap_or_else(|| "Indonesia".to_string()),
            display_name: display,
        }
    }).collect();

    Ok(results)
}

pub async fn fetch_weather(lat: f64, lon: f64) -> Result<Vec<WeatherData>> {
    // Try BMKG first, then fallback to Open-Meteo
    match fetch_bmkg(lat, lon).await {
        Ok(mut bmkg_data) => {
            // If BMKG data is incomplete, fill missing params from Open-Meteo
            if bmkg_data.is_empty() {
                fetch_open_meteo(lat, lon).await
            } else {
                // Check for missing fields and supplement from Open-Meteo if needed
                let has_pressure_missing = bmkg_data.iter().any(|d| d.pressure <= 0.0);
                let has_vis_missing = bmkg_data.iter().any(|d| d.visibility <= 0.0);

                if has_pressure_missing || has_vis_missing {
                    if let Ok(om_data) = fetch_open_meteo(lat, lon).await {
                        for item in bmkg_data.iter_mut() {
                            if let Some(om) = om_data.iter().find(|o| o.date == item.date && o.hour == item.hour) {
                                if item.pressure <= 0.0 {
                                    item.pressure = om.pressure;
                                }
                                if item.visibility <= 0.0 {
                                    item.visibility = om.visibility;
                                }
                            }
                        }
                    }
                }
                Ok(bmkg_data)
            }
        }
        Err(_) => {
            // BMKG failed, use Open-Meteo
            fetch_open_meteo(lat, lon).await
        }
    }
}

async fn fetch_bmkg(lat: f64, lon: f64) -> Result<Vec<WeatherData>> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("MineCast/1.0")
        .build()?;

    // BMKG API endpoint using lat/lon
    let url = format!(
        "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={:.4},{:.4}",
        lat, lon
    );

    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        return Err(anyhow!("BMKG API error: {}", resp.status()));
    }

    let text = resp.text().await?;
    let forecast: BmkgForecastResponse = serde_json::from_str(&text)
        .map_err(|e| anyhow!("BMKG parse error: {}", e))?;

    let mut results = Vec::new();
    let today = Local::now();

    for location in &forecast.data {
        for day_forecasts in &location.cuaca {
            for item in day_forecasts {
                if let Some(datetime_str) = &item.datetime {
                    // Parse "2024-01-15 06:00:00" format
                    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S") {
                        let date = dt.date().format("%Y-%m-%d").to_string();
                        let hour = dt.hour() as i32;

                        let weather_code = item.weather.unwrap_or(0);
                        let condition = bmkg_code_to_condition(weather_code);

                        let wind_dir_str = item.wind_direction.as_deref().unwrap_or("N");
                        let wind_dir_deg = bmkg_wind_to_degrees(wind_dir_str);
                        let wind_dir_label = degrees_to_compass(wind_dir_deg as f64);

                        let visibility = item.visibility.as_deref()
                            .map(|v| visibility_str_to_km(v))
                            .unwrap_or(10.0);

                        // Estimate rainfall from weather code
                        let rainfall = match weather_code {
                            60 | 61 | 80 => 1.5,
                            63 | 95 => 5.0,
                            65 | 97 => 15.0,
                            _ => 0.0,
                        };

                        let rain_prob = match weather_code {
                            60 | 61 | 80 => 70.0,
                            63 | 95 => 85.0,
                            65 | 97 => 95.0,
                            45 => 30.0,
                            2 | 3 | 4 => 20.0,
                            _ => 5.0,
                        };

                        results.push(WeatherData {
                            datetime: datetime_str.clone(),
                            date,
                            hour,
                            temperature: item.temperature.unwrap_or(28.0),
                            rainfall,
                            rain_probability: rain_prob,
                            weather_condition: condition,
                            weather_code,
                            wind_speed: item.wind_speed.unwrap_or(10.0),
                            wind_direction: wind_dir_deg,
                            wind_direction_label: wind_dir_label,
                            humidity: item.humidity.unwrap_or(75.0),
                            visibility,
                            pressure: 0.0, // BMKG often doesn't provide this
                            data_source: "BMKG".to_string(),
                        });
                    }
                }
            }
        }
    }

    if results.is_empty() {
        return Err(anyhow!("No BMKG data parsed"));
    }

    // Sort by date and hour
    results.sort_by(|a, b| a.date.cmp(&b.date).then(a.hour.cmp(&b.hour)));
    Ok(results)
}

async fn fetch_open_meteo(lat: f64, lon: f64) -> Result<Vec<WeatherData>> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("MineCast/1.0")
        .build()?;

    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&hourly=temperature_2m,precipitation,precipitation_probability,weathercode,windspeed_10m,winddirection_10m,relativehumidity_2m,visibility,surface_pressure&forecast_days=3&timezone=Asia%2FJakarta",
        lat, lon
    );

    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        return Err(anyhow!("Open-Meteo API error: {}", resp.status()));
    }

    let data: OpenMeteoResponse = resp.json().await?;
    let hourly = data.hourly;

    let mut results = Vec::new();
    for (i, time_str) in hourly.time.iter().enumerate() {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(time_str, "%Y-%m-%dT%H:%M") {
            let date = dt.date().format("%Y-%m-%d").to_string();
            let hour = dt.hour() as i32;
            let weather_code = hourly.weathercode.get(i).and_then(|v| *v).unwrap_or(0);
            let wind_deg = hourly.winddirection_10m.get(i).and_then(|v| *v).unwrap_or(0.0);
            let wind_label = degrees_to_compass(wind_deg);
            let visibility_m = hourly.visibility.get(i).and_then(|v| *v).unwrap_or(10000.0);

            results.push(WeatherData {
                datetime: time_str.replace("T", " ") + ":00",
                date,
                hour,
                temperature: hourly.temperature_2m.get(i).and_then(|v| *v).unwrap_or(28.0),
                rainfall: hourly.precipitation.get(i).and_then(|v| *v).unwrap_or(0.0),
                rain_probability: hourly.precipitation_probability.get(i).and_then(|v| *v).unwrap_or(0.0),
                weather_condition: wmo_code_to_condition(weather_code),
                weather_code,
                wind_speed: hourly.windspeed_10m.get(i).and_then(|v| *v).unwrap_or(0.0),
                wind_direction: wind_deg as i32,
                wind_direction_label: wind_label,
                humidity: hourly.relativehumidity_2m.get(i).and_then(|v| *v).unwrap_or(75.0),
                visibility: visibility_m / 1000.0,
                pressure: hourly.surface_pressure.get(i).and_then(|v| *v).unwrap_or(1013.0),
                data_source: "Open-Meteo".to_string(),
            });
        }
    }

    results.sort_by(|a, b| a.date.cmp(&b.date).then(a.hour.cmp(&b.hour)));
    Ok(results)
}

// ---- Operation Status Logic ----

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OperationStatus {
    pub status: String,
    pub status_code: String,
    pub color: String,
    pub reasons: Vec<String>,
}

pub fn calculate_operation_status(data: &WeatherData) -> OperationStatus {
    let mut reasons = Vec::new();
    let mut risk_score = 0i32;

    // Rainfall check
    if data.rainfall >= 50.0 {
        reasons.push("Curah hujan sangat lebat (≥50mm/jam)".to_string());
        risk_score += 100;
    } else if data.rainfall >= 20.0 {
        reasons.push("Curah hujan lebat (≥20mm/jam)".to_string());
        risk_score += 70;
    } else if data.rainfall >= 5.0 {
        reasons.push("Curah hujan sedang (≥5mm/jam)".to_string());
        risk_score += 40;
    } else if data.rainfall > 0.5 {
        reasons.push("Curah hujan ringan".to_string());
        risk_score += 20;
    }

    // Rain probability check
    if data.rain_probability >= 80.0 {
        reasons.push(format!("Probabilitas hujan tinggi ({:.0}%)", data.rain_probability));
        risk_score += 40;
    } else if data.rain_probability >= 50.0 {
        reasons.push(format!("Probabilitas hujan sedang ({:.0}%)", data.rain_probability));
        risk_score += 20;
    }

    // Wind speed check
    if data.wind_speed >= 50.0 {
        reasons.push(format!("Kecepatan angin ekstrem ({:.1} km/h)", data.wind_speed));
        risk_score += 100;
    } else if data.wind_speed >= 35.0 {
        reasons.push(format!("Angin kencang ({:.1} km/h)", data.wind_speed));
        risk_score += 60;
    } else if data.wind_speed >= 25.0 {
        reasons.push(format!("Angin sedang ({:.1} km/h)", data.wind_speed));
        risk_score += 20;
    }

    // Visibility check
    if data.visibility < 0.5 {
        reasons.push(format!("Jarak pandang sangat rendah ({:.1} km)", data.visibility));
        risk_score += 80;
    } else if data.visibility < 1.0 {
        reasons.push(format!("Jarak pandang rendah ({:.1} km)", data.visibility));
        risk_score += 50;
    } else if data.visibility < 3.0 {
        reasons.push(format!("Jarak pandang terbatas ({:.1} km)", data.visibility));
        risk_score += 20;
    }

    // Weather condition check
    let condition_lower = data.weather_condition.to_lowercase();
    if condition_lower.contains("petir") || condition_lower.contains("badai") {
        reasons.push(format!("Kondisi cuaca berbahaya: {}", data.weather_condition));
        risk_score += 100;
    } else if condition_lower.contains("lebat") {
        reasons.push(format!("Hujan lebat: {}", data.weather_condition));
        risk_score += 50;
    } else if condition_lower.contains("kabut") || condition_lower.contains("asap") {
        reasons.push(format!("Kondisi berkabut/berasap: {}", data.weather_condition));
        risk_score += 30;
    }

    let (status, status_code, color) = if risk_score >= 100 {
        ("⛔ Tidak Direkomendasikan".to_string(), "TIDAK_DIREKOMENDASIKAN".to_string(), "#dc2626".to_string())
    } else if risk_score >= 60 {
        ("🔴 Risiko Tinggi".to_string(), "RISIKO_TINGGI".to_string(), "#ef4444".to_string())
    } else if risk_score >= 20 {
        ("🟡 Waspada".to_string(), "WASPADA".to_string(), "#f59e0b".to_string())
    } else {
        if reasons.is_empty() {
            reasons.push("Kondisi cuaca aman untuk operasi".to_string());
        }
        ("🟢 Aman".to_string(), "AMAN".to_string(), "#22c55e".to_string())
    };

    OperationStatus { status, status_code, color, reasons }
}
