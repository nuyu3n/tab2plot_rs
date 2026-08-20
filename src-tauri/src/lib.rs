use base64::{engine::general_purpose, Engine as _};
use csv::ReaderBuilder;
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tab2plot::wrap::{
    detect_delimiter, encode_rgb_to_png, execute_batch_from_str, parse_table_str,
};
use tab2plot::{generate_graph_image, GraphConfig, SeriesData};

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
struct CsvPreview {
    total_rows: usize,
    sample_rows: Vec<Vec<String>>,
}

#[tauri::command]
#[allow(non_snake_case)]
fn load_csv_preview(filePath: String) -> Result<CsvPreview, String> {
    let mut file_str = String::new();
    File::open(&filePath)
        .and_then(|mut f| f.read_to_string(&mut file_str))
        .map_err(|e| format!("ファイルオープン失敗: {}", e))?;

    let delim = detect_delimiter(&file_str);
    let mut reader = ReaderBuilder::new()
        .delimiter(delim)
        .flexible(true)
        .has_headers(false)
        .comment(Some(b'#'))
        .from_reader(file_str.as_bytes());

    let mut sample_rows = Vec::new();
    let mut total_rows = 0usize;

    for result in reader.records() {
        let record = result.map_err(|e| e.to_string())?;
        total_rows += 1;
        if sample_rows.len() < 30 {
            sample_rows.push(record.iter().map(|f| f.trim().to_string()).collect());
        }
    }

    Ok(CsvPreview {
        total_rows,
        sample_rows,
    })
}

#[tauri::command]
#[allow(non_snake_case)]
fn parse_table_data(
    tableText: String,
    delimiter: Option<String>,
    config: Option<GraphConfig>,
) -> Result<Vec<SeriesData>, String> {
    let delim_byte = match delimiter.as_deref() {
        Some("tab") | Some("\t") => b'\t',
        Some("comma") | Some(",") => b',',
        Some("space") | Some(" ") => b' ',
        _ => detect_delimiter(&tableText),
    };
    parse_table_str(&tableText, delim_byte, &config.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
fn render_graph_base64(
    config: GraphConfig,
    seriesList: Vec<SeriesData>,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let rgb =
        generate_graph_image(width, height, &config, &seriesList).map_err(|e| e.to_string())?;
    let png = encode_rgb_to_png(width, height, &rgb).map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(png)
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
    let rgb =
        generate_graph_image(width, height, &config, &seriesList).map_err(|e| e.to_string())?;
    let png = encode_rgb_to_png(width, height, &rgb).map_err(|e| e.to_string())?;
    let out_path = Path::new(&filePath);
    if let Some(parent) = out_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::write(out_path, png).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
fn run_batch_json(batchJson: String, baseDir: Option<String>) -> Result<(), String> {
    let base_path = baseDir.as_deref().map(Path::new);
    execute_batch_from_str(&batchJson, base_path, None, None).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_csv_preview,
            parse_table_data,
            render_graph_base64,
            save_graph_png,
            run_batch_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
