use crate::{
    GraphConfig, GraphError, LineStyleType, MarkerType, SeriesData, generate_graph_image,
    generate_graph_svg,
};
use plotters::prelude::RGBColor;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

pub fn default_config() -> GraphConfig {
    GraphConfig::default()
}

/// 区切り文字の自動判定ヘルパー
pub fn detect_delimiter(table_text: &str) -> u8 {
    let first_line = table_text
        .lines()
        .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
        .unwrap_or("");
    if first_line.contains('\t') {
        b'\t'
    } else if first_line.contains(',') {
        b','
    } else if first_line.contains(' ') {
        b' '
    } else {
        b'\t'
    }
}

pub fn encode_rgb_to_png(width: u32, height: u32, rgb_data: &[u8]) -> Result<Vec<u8>, GraphError> {
    if width == 0 || height == 0 {
        return Err(GraphError::InvalidData(
            "画像の幅および高さは1px以上を指定してください".to_string(),
        ));
    }

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
        .has_headers(false)
        .flexible(true)
        .from_reader(data_str.as_bytes());

    let mut records_iter = rdr.records();
    let first_record = match records_iter.next() {
        Some(res) => res.map_err(|e| GraphError::InvalidData(format!("データ読込失敗: {}", e)))?,
        None => return Err(GraphError::InvalidData("データが空です".to_string())),
    };

    let num_cols = first_record.len();
    if num_cols < 2 {
        return Err(GraphError::InvalidData(
            "データ列が不足しています（最低2列必要です）".to_string(),
        ));
    }

    // 1行目の全列が数値変換可能かチェック（ヘッダー有無の自動判定）
    let is_headerless = first_record
        .iter()
        .all(|field| field.trim().parse::<f64>().is_ok());

    let (headers, first_data_row) = if is_headerless {
        let generated_headers: Vec<String> = (0..num_cols)
            .map(|i| {
                if i == 0 {
                    "X".to_string()
                } else {
                    format!("Series {}", i)
                }
            })
            .collect();
        (generated_headers, Some(first_record))
    } else {
        let extracted_headers: Vec<String> =
            first_record.iter().map(|s| s.trim().to_string()).collect();
        (extracted_headers, None)
    };

    let num_series = num_cols.saturating_sub(1);
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
                .cloned()
                .unwrap_or_else(|| format!("Series {}", i + 1));

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

    let process_record = |record: &csv::StringRecord,
                          row_idx: usize,
                          series_list: &mut [SeriesData]|
     -> Result<(), GraphError> {
        let x_str = record.get(0).unwrap_or("").trim();
        let x = match x_str.parse::<f64>() {
            Ok(val) => val,
            Err(_) => {
                eprintln!(
                    "[Warn] {}行目: X軸数値のパースに失敗したためスキップしました: '{}'",
                    row_idx, x_str
                );
                return Ok(());
            }
        };

        for i in 0..num_series {
            if let Some(val_str) = record.get(i + 1) {
                let trimmed = val_str.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match trimmed.parse::<f64>() {
                    Ok(y) => series_list[i].points.push((x, y)),
                    Err(_) => {
                        eprintln!(
                            "[Warn] {}行目 列{}: Y数値のパースに失敗しました: '{}'",
                            row_idx,
                            i + 2,
                            trimmed
                        );
                    }
                }
            }
        }
        Ok(())
    };

    let mut current_row = 1;
    if let Some(record) = first_data_row {
        process_record(&record, current_row, &mut series_list)?;
    }

    for result in records_iter {
        current_row += 1;
        let record = result.map_err(|e| {
            GraphError::InvalidData(format!("{}行目の読込失敗: {}", current_row, e))
        })?;
        process_record(&record, current_row, &mut series_list)?;
    }

    Ok(series_list)
}

/// 設定パースと Auto Range の共通計算ヘルパー
fn prepare_config_and_series(
    table_text: &str,
    config_json: Option<&str>,
    delimiter: Option<u8>,
) -> Result<(GraphConfig, Vec<SeriesData>), GraphError> {
    let parsed_json_val: Option<Value> = match config_json {
        Some(json) => Some(
            serde_json::from_str(json)
                .map_err(|e| GraphError::InvalidData(format!("設定JSONパース失敗: {}", e)))?,
        ),
        None => None,
    };

    let mut config: GraphConfig = match &parsed_json_val {
        Some(val) => serde_json::from_value(val.clone())
            .map_err(|e| GraphError::InvalidData(format!("設定構造体マッピング失敗: {}", e)))?,
        None => default_config(),
    };

    let delim = delimiter.unwrap_or_else(|| detect_delimiter(table_text));
    let series_list = parse_table_str(table_text, delim, &config)?;

    let has_explicit_x_range = parsed_json_val
        .as_ref()
        .map_or(false, |v| v.get("x_range").is_some());
    let has_explicit_y_range = parsed_json_val
        .as_ref()
        .map_or(false, |v| v.get("y_range").is_some());
    let has_explicit_y2_range = parsed_json_val
        .as_ref()
        .map_or(false, |v| v.get("y2_range").is_some());

    // X軸 Auto Range
    if !has_explicit_x_range {
        let mut x_min = f64::INFINITY;
        let mut x_max = f64::NEG_INFINITY;
        for s in &series_list {
            for &(x, _) in &s.points {
                if x < x_min {
                    x_min = x;
                }
                if x > x_max {
                    x_max = x;
                }
            }
        }
        if x_min.is_finite() && x_max.is_finite() {
            let margin = if (x_max - x_min).abs() < 1e-6 {
                1.0
            } else {
                (x_max - x_min) * 0.05
            };
            config.x_range = (x_min - margin)..(x_max + margin);
        }
    }

    // 第1Y軸 Auto Range (use_secondary == false)
    if !has_explicit_y_range {
        let mut y_min = f64::INFINITY;
        let mut y_max = f64::NEG_INFINITY;
        for s in series_list.iter().filter(|s| !s.use_secondary) {
            for &(_, y) in &s.points {
                if y < y_min {
                    y_min = y;
                }
                if y > y_max {
                    y_max = y;
                }
            }
        }
        if y_min.is_finite() && y_max.is_finite() {
            let margin = if (y_max - y_min).abs() < 1e-6 {
                1.0
            } else {
                (y_max - y_min) * 0.1
            };
            config.y_range = (y_min - margin)..(y_max + margin);
        }
    }

    // 第2Y軸 Auto Range (use_secondary == true)
    if !has_explicit_y2_range {
        let mut y2_min = f64::INFINITY;
        let mut y2_max = f64::NEG_INFINITY;
        for s in series_list.iter().filter(|s| s.use_secondary) {
            for &(_, y) in &s.points {
                if y < y2_min {
                    y2_min = y;
                }
                if y > y2_max {
                    y2_max = y;
                }
            }
        }
        if y2_min.is_finite() && y2_max.is_finite() {
            let margin = if (y2_max - y2_min).abs() < 1e-6 {
                1.0
            } else {
                (y2_max - y2_min) * 0.1
            };
            config.y2_range = (y2_min - margin)..(y2_max + margin);
        }
    }

    Ok((config, series_list))
}

/// PNGバイト列の生成
pub fn render_to_png_bytes(
    table_text: &str,
    config_json: Option<&str>,
    width: u32,
    height: u32,
    delimiter: Option<u8>,
) -> Result<Vec<u8>, GraphError> {
    if width == 0 || height == 0 {
        return Err(GraphError::InvalidData(
            "幅および高さは1px以上である必要があります".to_string(),
        ));
    }

    let (config, series_list) = prepare_config_and_series(table_text, config_json, delimiter)?;
    let raw_rgb = generate_graph_image(width, height, &config, &series_list)?;
    encode_rgb_to_png(width, height, &raw_rgb)
}

/// SVG文字列の生成
pub fn render_to_svg_str(
    table_text: &str,
    config_json: Option<&str>,
    width: u32,
    height: u32,
    delimiter: Option<u8>,
) -> Result<String, GraphError> {
    if width == 0 || height == 0 {
        return Err(GraphError::InvalidData(
            "幅および高さは1px以上である必要があります".to_string(),
        ));
    }

    let (config, series_list) = prepare_config_and_series(table_text, config_json, delimiter)?;
    generate_graph_svg(width, height, &config, &series_list)
}

/// ファイルから読み込み、PNG または SVG に書き出す（拡張子自動判別）
pub fn render_from_files(
    data_path: impl AsRef<Path>,
    output_path: impl AsRef<Path>,
    config_path: Option<impl AsRef<Path>>,
    width: u32,
    height: u32,
) -> Result<(), GraphError> {
    let mut data_str = String::new();
    File::open(&data_path)
        .and_then(|mut f| f.read_to_string(&mut data_str))
        .map_err(|e| {
            GraphError::InvalidData(format!(
                "データファイル読込エラー ({:?}): {}",
                data_path.as_ref(),
                e
            ))
        })?;

    let config_json = if let Some(p) = config_path {
        let mut json = String::new();
        File::open(&p)
            .and_then(|mut f| f.read_to_string(&mut json))
            .map_err(|e| {
                GraphError::InvalidData(format!("設定ファイル読込エラー ({:?}): {}", p.as_ref(), e))
            })?;
        Some(json)
    } else {
        None
    };

    let is_svg = output_path
        .as_ref()
        .extension()
        .map_or(false, |ext| ext.eq_ignore_ascii_case("svg"));

    if let Some(parent) = output_path.as_ref().parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| GraphError::Drawing(format!("出力ディレクトリ作成失敗: {}", e)))?;
        }
    }

    if is_svg {
        let svg_str = render_to_svg_str(&data_str, config_json.as_deref(), width, height, None)?;
        std::fs::write(&output_path, svg_str).map_err(|e| {
            GraphError::Drawing(format!(
                "SVG画像保存エラー ({:?}): {}",
                output_path.as_ref(),
                e
            ))
        })?;
    } else {
        let png_bytes =
            render_to_png_bytes(&data_str, config_json.as_deref(), width, height, None)?;
        std::fs::write(&output_path, png_bytes).map_err(|e| {
            GraphError::Drawing(format!(
                "画像保存エラー ({:?}): {}",
                output_path.as_ref(),
                e
            ))
        })?;
    }

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

pub fn merge_json(target: &mut Value, source: &Value) {
    match (target, source) {
        (Value::Object(t), Value::Object(s)) => {
            for (k, v) in s {
                merge_json(t.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (Value::Array(t), Value::Array(s)) => {
            for (i, val) in s.iter().enumerate() {
                if i < t.len() {
                    merge_json(&mut t[i], val);
                } else {
                    t.push(val.clone());
                }
            }
        }
        (t, s) => *t = s.clone(),
    }
}

/// 解析済み BatchConfig 構造体からのバッチ実行（PNG / SVG 自動判別対応）
pub fn execute_batch_config(
    batch: &BatchConfig,
    base_dir: Option<&Path>,
    cli_width_override: Option<u32>,
    cli_height_override: Option<u32>,
) -> Result<(), GraphError> {
    let resolve_path = |p: &str| -> PathBuf {
        let path = PathBuf::from(p);
        if path.is_absolute() || path.exists() {
            return path;
        }
        if let Some(base) = base_dir {
            let from_base = base.join(&path);
            if from_base.exists() || !base.as_os_str().is_empty() {
                return from_base;
            }
        }
        path
    };

    for (idx, task) in batch.tasks.iter().enumerate() {
        let input_path = resolve_path(&task.input);
        let output_path = match &task.output {
            Some(out) => resolve_path(out),
            None => input_path.with_extension("png"),
        };

        let width = task
            .width
            .or(batch.default_width)
            .or(cli_width_override)
            .unwrap_or(1920);
        let height = task
            .height
            .or(batch.default_height)
            .or(cli_height_override)
            .unwrap_or(1440);

        let mut final_config_val = batch
            .common
            .clone()
            .unwrap_or(Value::Object(Default::default()));

        if let Some(ref cfg_file) = task.config_path {
            let resolved_cfg = resolve_path(cfg_file);
            let mut ext_str = String::new();
            File::open(&resolved_cfg)
                .and_then(|mut f| f.read_to_string(&mut ext_str))
                .map_err(|e| {
                    GraphError::InvalidData(format!(
                        "個別設定ファイル読込失敗 ({:?}): {}",
                        resolved_cfg, e
                    ))
                })?;
            let ext_val: Value = serde_json::from_str(&ext_str)
                .map_err(|e| GraphError::InvalidData(format!("個別設定JSONパース失敗: {}", e)))?;
            merge_json(&mut final_config_val, &ext_val);
        }

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
                GraphError::InvalidData(format!("入力ファイル読込失敗 ({:?}): {}", input_path, e))
            })?;

        let is_svg = output_path
            .extension()
            .map_or(false, |ext| ext.eq_ignore_ascii_case("svg"));

        if let Some(parent) = output_path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| GraphError::Drawing(format!("出力フォルダ作成失敗: {}", e)))?;
            }
        }

        if is_svg {
            let svg_str =
                render_to_svg_str(&data_str, config_json_str.as_deref(), width, height, None)?;
            std::fs::write(&output_path, svg_str).map_err(|e| {
                GraphError::Drawing(format!("SVG画像保存失敗 ({:?}): {}", output_path, e))
            })?;
        } else {
            let png_bytes =
                render_to_png_bytes(&data_str, config_json_str.as_deref(), width, height, None)?;
            std::fs::write(&output_path, png_bytes).map_err(|e| {
                GraphError::Drawing(format!("画像保存失敗 ({:?}): {}", output_path, e))
            })?;
        }

        println!(
            "[Batch {}/{}] Saved: {:?}",
            idx + 1,
            batch.tasks.len(),
            output_path
        );
    }

    Ok(())
}

/// JSON文字列からのバッチ実行
pub fn execute_batch_from_str(
    batch_json_str: &str,
    base_dir: Option<&Path>,
    cli_width_override: Option<u32>,
    cli_height_override: Option<u32>,
) -> Result<(), GraphError> {
    let batch: BatchConfig = serde_json::from_str(batch_json_str)
        .map_err(|e| GraphError::InvalidData(format!("バッチ設定JSONパース失敗: {}", e)))?;
    execute_batch_config(&batch, base_dir, cli_width_override, cli_height_override)
}

/// ファイルパスからのバッチ実行
pub fn execute_batch(
    batch_config_path: impl AsRef<Path>,
    cli_width_override: Option<u32>,
    cli_height_override: Option<u32>,
) -> Result<(), GraphError> {
    let batch_path = batch_config_path.as_ref();
    let base_dir = batch_path.parent();

    let mut file_str = String::new();
    File::open(batch_path)
        .and_then(|mut f| f.read_to_string(&mut file_str))
        .map_err(|e| GraphError::InvalidData(format!("バッチ設定ファイル読込失敗: {}", e)))?;

    execute_batch_from_str(&file_str, base_dir, cli_width_override, cli_height_override)
}
