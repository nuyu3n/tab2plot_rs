use base64::{engine::general_purpose, Engine as _};
use csv::ReaderBuilder;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use tab2plot_lib::{generate_graph_image, GraphConfig, SeriesData};

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
fn load_points_from_csv(file_path: String) -> Result<Vec<(f64, f64)>, String> {
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .from_path(file_path)
        .map_err(|e| e.to_string())?;

    let mut points = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        if record.len() < 2 {
            continue;
        }

        let x = record
            .get(0)
            .unwrap_or("0")
            .trim()
            .parse::<f64>()
            .map_err(|e| e.to_string())?;
        let y = record
            .get(1)
            .unwrap_or("0")
            .trim()
            .parse::<f64>()
            .map_err(|e| e.to_string())?;
        points.push((x, y));
    }

    Ok(points)
}

#[tauri::command]
fn render_graph_preview(
    config: GraphConfig,
    series_list: Vec<SeriesData>,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let raw_rgb =
        generate_graph_image(width, height, &config, &series_list).map_err(|e| e.to_string())?;
    let png_bytes = encode_png(width, height, &raw_rgb)?;
    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(png_bytes)
    ))
}

#[tauri::command]
fn save_graph_png(
    config: GraphConfig,
    series_list: Vec<SeriesData>,
    width: u32,
    height: u32,
    file_path: String,
) -> Result<(), String> {
    let raw_rgb =
        generate_graph_image(width, height, &config, &series_list).map_err(|e| e.to_string())?;
    write_png_file(Path::new(&file_path), width, height, &raw_rgb)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_points_from_csv,
            render_graph_preview,
            save_graph_png,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
