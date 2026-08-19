use crate::{GraphConfig, GraphError, LineStyleType, MarkerType, SeriesData, generate_graph_image};
use plotters::prelude::RGBColor;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

pub fn default_config() -> GraphConfig {
    GraphConfig::default()
}

pub fn encode_rgb_to_png(width: u32, height: u32, rgb_data: &[u8]) -> Result<Vec<u8>, GraphError> {
    let mut png_buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(Cursor::new(&mut png_buf), width, height);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);

        let mut writer = encoder
            .write_header()
            .map_err(|e| GraphError::Drawing(format!("PNGヘッダー書き込みエラー: {}", e)))?;
        writer
            .write_image_data(rgb_data)
            .map_err(|e| GraphError::Drawing(format!("PNG画像エンコードエラー: {}", e)))?;
    }
    Ok(png_buf)
}

pub fn parse_table_str(
    data_str: &str,
    delimiter: u8,
    config: &GraphConfig,
) -> Result<Vec<SeriesData>, GraphError> {
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .comment(Some(b'#'))
        .from_reader(data_str.as_bytes());

    let headers = rdr
        .headers()
        .map_err(|e| GraphError::InvalidData(format!("ヘッダー取得失敗: {}", e)))?
        .clone();

    let num_series = headers.len().saturating_sub(1);
    if num_series == 0 {
        return Err(GraphError::InvalidData(
            "データ列が不足しています（最低2列必要です）".to_string(),
        ));
    }

    let default_colors = [
        RGBColor(0, 102, 204),
        RGBColor(204, 51, 0),
        RGBColor(0, 153, 76),
        RGBColor(230, 159, 0),
        RGBColor(148, 0, 211),
    ];

    let mut series_list: Vec<SeriesData> = (0..num_series)
        .map(|i| {
            let custom_style = config.series_styles.get(i);
            let header_label = headers
                .get(i + 1)
                .unwrap_or(&format!("Series {}", i + 1))
                .to_string();

            let label = custom_style
                .and_then(|s| s.label.clone())
                .unwrap_or(header_label);

            let color = custom_style
                .and_then(|s| s.color)
                .map(|[r, g, b]| RGBColor(r, g, b))
                .unwrap_or_else(|| default_colors[i % default_colors.len()]);

            let marker_type = custom_style
                .and_then(|s| s.marker_type)
                .unwrap_or(MarkerType::CircleFilled);

            let marker_size = custom_style.and_then(|s| s.marker_size).unwrap_or(4);
            let line_style = custom_style
                .and_then(|s| s.line_style)
                .unwrap_or(LineStyleType::Solid);
            let line_width = custom_style.and_then(|s| s.line_width).unwrap_or(2);
            let use_secondary = custom_style.and_then(|s| s.use_secondary).unwrap_or(false);

            SeriesData {
                label,
                points: Vec::new(),
                marker_type,
                marker_size,
                line_style,
                line_width,
                color,
                use_secondary,
            }
        })
        .collect();

    for (row_idx, result) in rdr.records().enumerate() {
        let record = result.map_err(|e| {
            GraphError::InvalidData(format!("{}行目の読込失敗: {}", row_idx + 1, e))
        })?;

        if let Ok(x) = record.get(0).unwrap_or("").trim().parse::<f64>() {
            for i in 0..num_series {
                if let Some(val_str) = record.get(i + 1) {
                    if let Ok(y) = val_str.trim().parse::<f64>() {
                        series_list[i].points.push((x, y));
                    }
                }
            }
        }
    }

    Ok(series_list)
}

pub fn render_to_png_bytes(
    table_text: &str,
    config_json: Option<&str>,
    width: u32,
    height: u32,
    delimiter: Option<u8>,
) -> Result<Vec<u8>, GraphError> {
    let mut config: GraphConfig = match config_json {
        Some(json) => serde_json::from_str(json)
            .map_err(|e| GraphError::InvalidData(format!("設定JSONのパース失敗: {}", e)))?,
        None => default_config(),
    };

    let delim = delimiter.unwrap_or_else(|| {
        if table_text.contains('\t') {
            b'\t'
        } else {
            b','
        }
    });

    let series_list = parse_table_str(table_text, delim, &config)?;

    // JSON未指定、または範囲未設定時の Auto Range 算出
    if config_json.is_none() || (config.x_range.start == 0.0 && config.x_range.end == 1.0) {
        let mut x_min = f64::INFINITY;
        let mut x_max = f64::NEG_INFINITY;
        let mut y_min = f64::INFINITY;
        let mut y_max = f64::NEG_INFINITY;

        for s in &series_list {
            for &(x, y) in &s.points {
                if x < x_min {
                    x_min = x;
                }
                if x > x_max {
                    x_max = x;
                }
                if y < y_min {
                    y_min = y;
                }
                if y > y_max {
                    y_max = y;
                }
            }
        }

        if x_min.is_finite() && x_max.is_finite() {
            config.x_range = x_min..x_max;
        }
        if y_min.is_finite() && y_max.is_finite() {
            let y_margin = if (y_max - y_min).abs() < 1e-6 {
                1.0
            } else {
                (y_max - y_min) * 0.1
            };
            config.y_range = (y_min - y_margin)..(y_max + y_margin);
        }
    }

    let raw_rgb = generate_graph_image(width, height, &config, &series_list)?;
    encode_rgb_to_png(width, height, &raw_rgb)
}

pub fn render_from_files(
    data_path: impl AsRef<Path>,
    output_png_path: impl AsRef<Path>,
    config_path: Option<impl AsRef<Path>>,
    width: u32,
    height: u32,
) -> Result<(), GraphError> {
    let mut data_str = String::new();
    File::open(&data_path)
        .and_then(|mut f| f.read_to_string(&mut data_str))
        .map_err(|e| GraphError::InvalidData(format!("データファイル読込エラー: {}", e)))?;

    let config_json = if let Some(p) = config_path {
        let mut json = String::new();
        File::open(p)
            .and_then(|mut f| f.read_to_string(&mut json))
            .map_err(|e| GraphError::InvalidData(format!("設定ファイル読込エラー: {}", e)))?;
        Some(json)
    } else {
        None
    };

    let png_bytes = render_to_png_bytes(&data_str, config_json.as_deref(), width, height, None)?;

    if let Some(parent) = output_png_path.as_ref().parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| GraphError::Drawing(format!("出力ディレクトリ作成失敗: {}", e)))?;
        }
    }

    std::fs::write(output_png_path, png_bytes)
        .map_err(|e| GraphError::Drawing(format!("画像保存エラー: {}", e)))?;

    Ok(())
}

// --- バッチ実行用データ構造とマージ処理 ---

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BatchTask {
    pub input: String,
    pub output: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub config_path: Option<String>,
    pub config: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BatchConfig {
    #[serde(default)]
    pub common: Option<Value>,
    #[serde(default)]
    pub default_width: Option<u32>,
    #[serde(default)]
    pub default_height: Option<u32>,
    pub tasks: Vec<BatchTask>,
}

fn merge_json(target: &mut Value, source: &Value) {
    match (target, source) {
        (Value::Object(t), Value::Object(s)) => {
            for (k, v) in s {
                merge_json(t.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (t, s) => *t = s.clone(),
    }
}

pub fn execute_batch(batch_config_path: impl AsRef<Path>) -> Result<(), GraphError> {
    let mut file_str = String::new();
    File::open(&batch_config_path)
        .and_then(|mut f| f.read_to_string(&mut file_str))
        .map_err(|e| GraphError::InvalidData(format!("バッチ設定ファイル読込失敗: {}", e)))?;

    let batch: BatchConfig = serde_json::from_str(&file_str)
        .map_err(|e| GraphError::InvalidData(format!("バッチ設定JSONパース失敗: {}", e)))?;

    for (idx, task) in batch.tasks.iter().enumerate() {
        let input_path = PathBuf::from(&task.input);
        let output_path = match &task.output {
            Some(out) => PathBuf::from(out),
            None => input_path.with_extension("png"),
        };

        let width = task.width.or(batch.default_width).unwrap_or(1920);
        let height = task.height.or(batch.default_height).unwrap_or(1440);

        // 共通設定をベースに構築
        let mut final_config_val = batch
            .common
            .clone()
            .unwrap_or(Value::Object(Default::default()));

        // 外部JSON設定ファイルが指定されていればマージ
        if let Some(ref cfg_file) = task.config_path {
            let mut ext_str = String::new();
            File::open(cfg_file)
                .and_then(|mut f| f.read_to_string(&mut ext_str))
                .map_err(|e| GraphError::InvalidData(format!("個別設定ファイル読込失敗: {}", e)))?;
            let ext_val: Value = serde_json::from_str(&ext_str)
                .map_err(|e| GraphError::InvalidData(format!("個別設定JSONパース失敗: {}", e)))?;
            merge_json(&mut final_config_val, &ext_val);
        }

        // タスク内のインライン設定があればマージ
        if let Some(ref inline_cfg) = task.config {
            merge_json(&mut final_config_val, inline_cfg);
        }

        let config_json_str = if final_config_val.as_object().map_or(true, |o| o.is_empty()) {
            None
        } else {
            Some(final_config_val.to_string())
        };

        let mut data_str = String::new();
        File::open(&input_path)
            .and_then(|mut f| f.read_to_string(&mut data_str))
            .map_err(|e| {
                GraphError::InvalidData(format!("入力ファイル読込失敗 ({}): {}", task.input, e))
            })?;

        let png_bytes =
            render_to_png_bytes(&data_str, config_json_str.as_deref(), width, height, None)?;

        if let Some(parent) = output_path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| GraphError::Drawing(format!("出力フォルダ作成失敗: {}", e)))?;
            }
        }

        std::fs::write(&output_path, png_bytes)
            .map_err(|e| GraphError::Drawing(format!("画像保存失敗 ({:?}): {}", output_path, e)))?;

        println!(
            "[Batch {}/{}] Saved: {:?}",
            idx + 1,
            batch.tasks.len(),
            output_path
        );
    }

    Ok(())
}
