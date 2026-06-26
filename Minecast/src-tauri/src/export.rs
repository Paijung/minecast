// src-tauri/src/export.rs
// MineCast Excel Export Engine

use xlsxwriter::{Workbook, Format, FormatColor, FormatAlignment};
use anyhow::Result;
use crate::database::{ForecastRecord, ActualRecord, DbConn, get_forecasts_range, get_actuals_for_date, get_daily_stats};
use std::path::PathBuf;
use chrono::Local;

pub fn export_daily(
    conn: &DbConn,
    location_id: i64,
    location_name: &str,
    date: &str,
    export_path: &PathBuf,
) -> Result<PathBuf> {
    let filename = format!("MineCast_{}_{}.xlsx", location_name.replace(" ", "_"), date.replace("-", ""));
    let filepath = export_path.join(&filename);

    let workbook = Workbook::new(filepath.to_str().unwrap())?;

    // === Sheet 1: Forecast Data ===
    let mut sheet = workbook.add_worksheet(Some("Data Forecast"))?;

    // Formats
    let title_fmt = workbook.add_format()
        .set_bold()
        .set_font_size(14.0)
        .set_font_color(FormatColor::Custom(0x1e3a5f));

    let header_fmt = workbook.add_format()
        .set_bold()
        .set_bg_color(FormatColor::Custom(0x1e3a5f))
        .set_font_color(FormatColor::White)
        .set_align(FormatAlignment::Center)
        .set_border(xlsxwriter::FormatBorder::Thin);

    let data_fmt = workbook.add_format()
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let num_fmt = workbook.add_format()
        .set_num_format("0.0")
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let green_fmt = workbook.add_format()
        .set_bg_color(FormatColor::Custom(0x86efac))
        .set_bold()
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let yellow_fmt = workbook.add_format()
        .set_bg_color(FormatColor::Custom(0xfde68a))
        .set_bold()
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let orange_fmt = workbook.add_format()
        .set_bg_color(FormatColor::Custom(0xfca5a5))
        .set_bold()
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let red_fmt = workbook.add_format()
        .set_bg_color(FormatColor::Custom(0xef4444))
        .set_font_color(FormatColor::White)
        .set_bold()
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    // Title
    sheet.write_string(0, 0, "MineCast - Laporan Cuaca Harian", Some(&title_fmt))?;
    sheet.write_string(1, 0, &format!("Lokasi: {} | Tanggal: {}", location_name, date), None)?;
    sheet.write_string(2, 0, &format!("Diekspor: {}", Local::now().format("%d/%m/%Y %H:%M")), None)?;

    // Merge cells for title
    sheet.merge_range(0, 0, 0, 10, "MineCast - Laporan Cuaca Harian", Some(&title_fmt))?;

    // Headers
    let headers = ["Jam", "Suhu (°C)", "Curah Hujan (mm)", "Prob. Hujan (%)",
                   "Kondisi", "Angin (km/h)", "Arah", "Kelembapan (%)",
                   "Jarak Pandang (km)", "Tekanan (hPa)", "Status Operasi", "Aktual"];
    for (i, h) in headers.iter().enumerate() {
        sheet.write_string(4, i as u16, h, Some(&header_fmt))?;
    }

    // Set column widths
    sheet.set_column(0, 0, 8.0, None)?;
    sheet.set_column(1, 3, 14.0, None)?;
    sheet.set_column(4, 4, 20.0, None)?;
    sheet.set_column(5, 9, 14.0, None)?;
    sheet.set_column(10, 10, 22.0, None)?;
    sheet.set_column(11, 11, 14.0, None)?;

    let forecasts = get_forecasts_range(conn, location_id, date, date);
    let actuals = get_actuals_for_date(conn, location_id, date);

    for (i, f) in forecasts.iter().enumerate() {
        let row = (i + 5) as u32;
        let status_fmt = match f.operation_status.as_str() {
            s if s.contains("TIDAK") => &red_fmt,
            s if s.contains("RISIKO") => &orange_fmt,
            s if s.contains("WASPADA") => &yellow_fmt,
            _ => &green_fmt,
        };

        let actual_text = actuals.iter()
            .find(|a| a.record_hour == f.forecast_hour)
            .map(|a| if a.is_raining { "☔ Hujan" } else { "☀ Tidak Hujan" })
            .unwrap_or("-");

        sheet.write_string(row, 0, &format!("{:02}:00", f.forecast_hour), Some(&data_fmt))?;
        sheet.write_number(row, 1, f.temperature, Some(&num_fmt))?;
        sheet.write_number(row, 2, f.rainfall, Some(&num_fmt))?;
        sheet.write_number(row, 3, f.rain_probability, Some(&num_fmt))?;
        sheet.write_string(row, 4, &f.weather_condition, Some(&data_fmt))?;
        sheet.write_number(row, 5, f.wind_speed, Some(&num_fmt))?;
        sheet.write_string(row, 6, &f.wind_direction_label, Some(&data_fmt))?;
        sheet.write_number(row, 7, f.humidity, Some(&num_fmt))?;
        sheet.write_number(row, 8, f.visibility, Some(&num_fmt))?;
        sheet.write_number(row, 9, f.pressure, Some(&num_fmt))?;
        sheet.write_string(row, 10, &f.operation_status, Some(status_fmt))?;
        sheet.write_string(row, 11, actual_text, Some(&data_fmt))?;
    }

    // === Sheet 2: Summary ===
    let mut summary = workbook.add_worksheet(Some("Ringkasan"))?;

    let sum_title_fmt = workbook.add_format()
        .set_bold()
        .set_font_size(12.0)
        .set_bg_color(FormatColor::Custom(0x1e3a5f))
        .set_font_color(FormatColor::White)
        .set_align(FormatAlignment::Center);

    let sum_label_fmt = workbook.add_format()
        .set_bold()
        .set_bg_color(FormatColor::Custom(0xe2e8f0));

    let sum_value_fmt = workbook.add_format()
        .set_align(FormatAlignment::Center);

    summary.write_string(0, 0, "RINGKASAN HARIAN - MINECAST", Some(&sum_title_fmt))?;
    summary.merge_range(0, 0, 0, 3, "RINGKASAN HARIAN - MINECAST", Some(&sum_title_fmt))?;

    summary.write_string(2, 0, "Lokasi:", Some(&sum_label_fmt))?;
    summary.write_string(2, 1, location_name, None)?;
    summary.write_string(3, 0, "Tanggal:", Some(&sum_label_fmt))?;
    summary.write_string(3, 1, date, None)?;

    if let Some(stats) = get_daily_stats(conn, location_id, date) {
        summary.write_string(5, 0, "Akurasi Forecast:", Some(&sum_label_fmt))?;
        summary.write_string(5, 1, &format!("{:.1}%", stats.accuracy_percent), Some(&sum_value_fmt))?;
        summary.write_string(6, 0, "Jam Hujan:", Some(&sum_label_fmt))?;
        summary.write_number(6, 1, stats.rainy_hours as f64, Some(&sum_value_fmt))?;
        summary.write_string(7, 0, "Jam Kering:", Some(&sum_label_fmt))?;
        summary.write_number(7, 1, stats.dry_hours as f64, Some(&sum_value_fmt))?;
        summary.write_string(8, 0, "Total Curah Hujan:", Some(&sum_label_fmt))?;
        summary.write_string(8, 1, &format!("{:.1} mm", stats.total_rainfall), Some(&sum_value_fmt))?;
        summary.write_string(9, 0, "Curah Hujan Maks:", Some(&sum_label_fmt))?;
        summary.write_string(9, 1, &format!("{:.1} mm", stats.max_rainfall), Some(&sum_value_fmt))?;
    }

    summary.set_column(0, 0, 22.0, None)?;
    summary.set_column(1, 1, 18.0, None)?;

    workbook.close()?;
    Ok(filepath)
}

pub fn export_range(
    conn: &DbConn,
    location_id: i64,
    location_name: &str,
    start_date: &str,
    end_date: &str,
    export_path: &PathBuf,
) -> Result<PathBuf> {
    let filename = format!("MineCast_{}_{}_{}.xlsx",
        location_name.replace(" ", "_"),
        start_date.replace("-", ""),
        end_date.replace("-", "")
    );
    let filepath = export_path.join(&filename);

    let workbook = Workbook::new(filepath.to_str().unwrap())?;

    let header_fmt = workbook.add_format()
        .set_bold()
        .set_bg_color(FormatColor::Custom(0x1e3a5f))
        .set_font_color(FormatColor::White)
        .set_align(FormatAlignment::Center)
        .set_border(xlsxwriter::FormatBorder::Thin);

    let data_fmt = workbook.add_format()
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let num_fmt = workbook.add_format()
        .set_num_format("0.0")
        .set_border(xlsxwriter::FormatBorder::Thin)
        .set_align(FormatAlignment::Center);

    let mut sheet = workbook.add_worksheet(Some("Data Forecast"))?;

    let title_fmt = workbook.add_format()
        .set_bold()
        .set_font_size(14.0);

    sheet.merge_range(0, 0, 0, 11, "MineCast - Laporan Cuaca Rentang Tanggal", Some(&title_fmt))?;
    sheet.write_string(1, 0, &format!("Lokasi: {} | Periode: {} s/d {}", location_name, start_date, end_date), None)?;

    let headers = ["Tanggal", "Jam", "Suhu (°C)", "Curah Hujan (mm)", "Prob. Hujan (%)",
                   "Kondisi", "Angin (km/h)", "Arah", "Kelembapan (%)", "Jarak Pandang (km)",
                   "Tekanan (hPa)", "Status Operasi"];
    for (i, h) in headers.iter().enumerate() {
        sheet.write_string(3, i as u16, h, Some(&header_fmt))?;
    }

    sheet.set_column(0, 0, 12.0, None)?;
    sheet.set_column(1, 1, 8.0, None)?;
    sheet.set_column(2, 4, 14.0, None)?;
    sheet.set_column(5, 5, 20.0, None)?;
    sheet.set_column(6, 10, 14.0, None)?;
    sheet.set_column(11, 11, 22.0, None)?;

    let forecasts = get_forecasts_range(conn, location_id, start_date, end_date);

    for (i, f) in forecasts.iter().enumerate() {
        let row = (i + 4) as u32;
        sheet.write_string(row, 0, &f.forecast_date, Some(&data_fmt))?;
        sheet.write_string(row, 1, &format!("{:02}:00", f.forecast_hour), Some(&data_fmt))?;
        sheet.write_number(row, 2, f.temperature, Some(&num_fmt))?;
        sheet.write_number(row, 3, f.rainfall, Some(&num_fmt))?;
        sheet.write_number(row, 4, f.rain_probability, Some(&num_fmt))?;
        sheet.write_string(row, 5, &f.weather_condition, Some(&data_fmt))?;
        sheet.write_number(row, 6, f.wind_speed, Some(&num_fmt))?;
        sheet.write_string(row, 7, &f.wind_direction_label, Some(&data_fmt))?;
        sheet.write_number(row, 8, f.humidity, Some(&num_fmt))?;
        sheet.write_number(row, 9, f.visibility, Some(&num_fmt))?;
        sheet.write_number(row, 10, f.pressure, Some(&num_fmt))?;
        sheet.write_string(row, 11, &f.operation_status, Some(&data_fmt))?;
    }

    workbook.close()?;
    Ok(filepath)
}
