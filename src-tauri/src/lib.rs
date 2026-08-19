use base64::{engine::general_purpose, Engine as _};
use csv::ReaderBuilder;
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tab2plot::wrap::{encode_rgb_to_png, parse_table_str, BatchConfig};
use tab2plot::{generate_graph_image, GraphConfig, SeriesData};

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
struct CsvPreview {
    total_rows: usize,
    sample_rows: Vec<Vec<String>>,
}

/// ファイル冒頭のテーブルプレビュー取得
#[tauri::command]
#[allow(non_snake_case)]
fn load_csv_preview(filePath: String) -> Result<CsvPreview, String> {
    let mut file_str = String::new();
    File::open(&filePath)
        .and_then(|mut f| f.read_to_string(&mut file_str))
        .map_err(|e| format!("ファイルオープン失敗: {}", e))?;

    let delim = if file_str.contains('\t') { b'\t' } else { b',' };

    let mut reader = ReaderBuilder::new()
        .delimiter(delim)
        .flexible(true)
        .has_headers(false)
        .from_reader(file_str.as_bytes());

    let mut sample_rows = Vec::new();
    let mut total_rows = 0usize;

    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        total_rows += 1;

        if sample_rows.len() < 30 {
            sample_rows.push(record.iter().map(|field| field.to_string()).collect());
        }
    }

    Ok(CsvPreview {
        total_rows,
        sample_rows,
    })
}

/// CSV/TSV文字列から複数系列データをパース
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
        _ => {
            if tableText.contains('\t') {
                b'\t'
            } else {
                b','
            }
        }
    };

    let cfg = config.unwrap_or_default();
    parse_table_str(&tableText, delim_byte, &cfg).map_err(|e| e.to_string())
}

/// プレビュー用 Base64 画像生成
#[tauri::command]
#[allow(non_snake_case)]
fn render_graph_base64(
    config: GraphConfig,
    seriesList: Vec<SeriesData>,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let raw_rgb =
        generate_graph_image(width, height, &config, &seriesList).map_err(|e| e.to_string())?;
    let png_bytes = encode_rgb_to_png(width, height, &raw_rgb).map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(png_bytes)
    ))
}

/// 単一グラフの PNG 保存
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
    let png_bytes = encode_rgb_to_png(width, height, &raw_rgb).map_err(|e| e.to_string())?;

    let out_path = Path::new(&filePath);
    if let Some(parent) = out_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    std::fs::write(out_path, png_bytes).map_err(|e| e.to_string())
}

/// バッチ設定 JSON 文字列から一括生成
#[tauri::command]
#[allow(non_snake_case)]
fn run_batch_json(batchJson: String) -> Result<(), String> {
    let batch: BatchConfig =
        serde_json::from_str(&batchJson).map_err(|e| format!("バッチ設定JSONパース失敗: {}", e))?;

    // 一時ファイルを経由せずインメモリで一括実行
    for (idx, task) in batch.tasks.iter().enumerate() {
        let input_path = std::path::PathBuf::from(&task.input);
        let output_path = match &task.output {
            Some(out) => std::path::PathBuf::from(out),
            None => input_path.with_extension("png"),
        };

        let width = task.width.or(batch.default_width).unwrap_or(1920);
        let height = task.height.or(batch.default_height).unwrap_or(1440);

        let mut final_config_val = batch
            .common
            .clone()
            .unwrap_or(serde_json::Value::Object(Default::default()));

        if let Some(ref inline_cfg) = task.config {
            if let (serde_json::Value::Object(t), serde_json::Value::Object(s)) =
                (&mut final_config_val, inline_cfg)
            {
                for (k, v) in s {
                    t.insert(k.clone(), v.clone());
                }
            }
        }

        let config_json_str = if final_config_val.as_object().map_or(true, |o| o.is_empty()) {
            None
        } else {
            Some(final_config_val.to_string())
        };

        let mut data_str = String::new();
        File::open(&input_path)
            .and_then(|mut f| f.read_to_string(&mut data_str))
            .map_err(|e| format!("入力読込失敗 ({}): {}", task.input, e))?;

        let png_bytes = tab2plot::wrap::render_to_png_bytes(
            &data_str,
            config_json_str.as_deref(),
            width,
            height,
            None,
        )
        .map_err(|e| e.to_string())?;

        if let Some(parent) = output_path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }

        std::fs::write(&output_path, png_bytes)
            .map_err(|e| format!("画像保存失敗 ({:?}): {}", output_path, e))?;

        println!(
            "[Tauri Batch {}/{}] Saved: {:?}",
            idx + 1,
            batch.tasks.len(),
            output_path
        );
    }

    Ok(())
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
