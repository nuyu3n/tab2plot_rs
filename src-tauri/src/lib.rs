use base64::{engine::general_purpose, Engine as _};
use csv::ReaderBuilder;
use serde::Serialize;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use tab2plot_lib::{generate_graph_image, GraphConfig, SeriesData};

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
struct CsvPreview {
    total_rows: usize,
    sample_rows: Vec<Vec<String>>,
}

fn encode_png(width: u32, height: u32, raw_rgb: &[u8]) -> Result<Vec<u8>, String> {
    let mut png_bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer
            .write_image_data(raw_rgb)
            .map_err(|e| e.to_string())?;
    }
    Ok(png_bytes)
}

fn write_png_file(path: &Path, width: u32, height: u32, raw_rgb: &[u8]) -> Result<(), String> {
    let file = File::create(path).map_err(|e| e.to_string())?;
    let mut writer = BufWriter::new(file);
    let mut encoder = png::Encoder::new(&mut writer, width, height);
    encoder.set_color(png::ColorType::Rgb);
    encoder.set_depth(png::BitDepth::Eight);
    {
        let mut png_writer = encoder.write_header().map_err(|e| e.to_string())?;
        png_writer
            .write_image_data(raw_rgb)
            .map_err(|e| e.to_string())?;
    }
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
fn load_csv_preview(filePath: String) -> Result<CsvPreview, String> {
    let mut reader = ReaderBuilder::new()
        .flexible(true)
        .has_headers(false)
        .from_path(filePath)
        .map_err(|e| e.to_string())?;

    let mut sample_rows = Vec::new();
    let mut total_rows = 0usize;

    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        total_rows += 1;

        if sample_rows.len() < 24 {
            sample_rows.push(record.iter().map(|field| field.to_string()).collect());
        }
    }

    Ok(CsvPreview {
        total_rows,
        sample_rows,
    })
}

#[tauri::command]
#[allow(non_snake_case)]
fn load_points_from_csv(filePath: String) -> Result<Vec<(f64, f64)>, String> {
    let mut reader = ReaderBuilder::new()
        .flexible(true)
        .has_headers(false)
        .from_path(filePath)
        .map_err(|e| e.to_string())?;

    let mut points = Vec::new();
    for (line_index, record) in reader.records().enumerate() {
        let record = record.map_err(|e| e.to_string())?;
        if record.len() < 2 {
            continue;
        }

        let x_text = record.get(0).unwrap_or("").trim();
        let y_text = record.get(1).unwrap_or("").trim();

        if x_text.is_empty() || y_text.is_empty() {
            continue;
        }

        let x = match x_text.parse::<f64>() {
            Ok(value) => value,
            Err(_) if line_index == 0 => continue,
            Err(error) => {
                return Err(format!(
                    "CSV {} 行目のX値を数値に変換できません: {}",
                    line_index + 1,
                    error
                ));
            }
        };

        let y = match y_text.parse::<f64>() {
            Ok(value) => value,
            Err(_) if line_index == 0 => continue,
            Err(error) => {
                return Err(format!(
                    "CSV {} 行目のY値を数値に変換できません: {}",
                    line_index + 1,
                    error
                ));
            }
        };
        points.push((x, y));
    }

    Ok(points)
}

#[tauri::command]
#[allow(non_snake_case)]
fn render_graph_preview(
    config: GraphConfig,
    seriesList: Vec<SeriesData>,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let raw_rgb =
        generate_graph_image(width, height, &config, &seriesList).map_err(|e| e.to_string())?;
    let png_bytes = encode_png(width, height, &raw_rgb)?;
    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(png_bytes)
    ))
}

#[tauri::command]
#[allow(non_snake_case)]
fn save_graph_png(
    config: GraphConfig,
    seriesList: Vec<SeriesData>,
    width: u32,
    height: u32,
    filePath: String,
) -> Result<(), String> {
    let raw_rgb =
        generate_graph_image(width, height, &config, &seriesList).map_err(|e| e.to_string())?;
    write_png_file(Path::new(&filePath), width, height, &raw_rgb)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_csv_preview,
            load_points_from_csv,
            render_graph_preview,
            save_graph_png,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
