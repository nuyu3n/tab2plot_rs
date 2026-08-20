use plotters::chart::{DualCoordChartContext, SeriesLabelPosition};
use plotters::coord::cartesian::Cartesian2d;
use plotters::coord::ranged1d::Ranged;
use plotters::prelude::*;
use plotters::style::{
    FontStyle, TextStyle, register_font,
    text_anchor::{HPos, Pos, VPos},
};
use serde::{Deserialize, Serialize};
use std::ops::Range;
use std::sync::OnceLock;

pub mod wrap;

// 埋め込みフォント（Serif & Sans-Serif）
const FONT_SERIF_DATA: &[u8] = include_bytes!("../assets/NotoSerifJP-Regular.ttf");
const FONT_SANS_DATA: &[u8] = include_bytes!("../assets/NotoSansJP-Regular.ttf");

pub const FONT_SERIF: &str = "Noto Serif JP";
pub const FONT_SANS: &str = "Noto Sans JP";

/// Serif と Sans の両方を登録
fn ensure_font_registered() -> Result<(), GraphError> {
    static INIT: OnceLock<Result<(), String>> = OnceLock::new();
    let res = INIT.get_or_init(|| {
        register_font(FONT_SERIF, FontStyle::Normal, FONT_SERIF_DATA)
            .map_err(|_| "Noto Serif JP の登録に失敗しました".to_string())?;
        register_font(FONT_SANS, FontStyle::Normal, FONT_SANS_DATA)
            .map_err(|_| "Noto Sans JP の登録に失敗しました".to_string())?;
        Ok(())
    });

    match res {
        Ok(()) => Ok(()),
        Err(err) => Err(GraphError::Drawing(err.clone())),
    }
}

/// グラフ描画エラー
#[derive(Debug)]
pub enum GraphError {
    Drawing(String),
    InvalidData(String),
}

impl std::fmt::Display for GraphError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GraphError::Drawing(msg) => write!(f, "グラフ描画エラー: {}", msg),
            GraphError::InvalidData(msg) => write!(f, "データエラー: {}", msg),
        }
    }
}

impl std::error::Error for GraphError {}

/// 線のスタイル
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Debug)]
pub enum LineStyleType {
    Solid,
    Dashed,
    Dotted,
    DashDot,
    None,
}

impl Default for LineStyleType {
    fn default() -> Self {
        LineStyleType::Solid
    }
}

/// マーカーの形状
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Debug)]
pub enum MarkerType {
    CircleFilled,
    CircleEmpty,
    Cross,
    None,
}

impl Default for MarkerType {
    fn default() -> Self {
        MarkerType::CircleFilled
    }
}

/// 凡例の表示位置
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Debug)]
pub enum LegendPosition {
    UpperRight,
    UpperLeft,
    LowerRight,
    LowerLeft,
    MiddleLeft,
    MiddleRight,
}

impl Default for LegendPosition {
    fn default() -> Self {
        LegendPosition::UpperRight
    }
}

impl From<LegendPosition> for SeriesLabelPosition {
    fn from(pos: LegendPosition) -> Self {
        match pos {
            LegendPosition::UpperRight => SeriesLabelPosition::UpperRight,
            LegendPosition::UpperLeft => SeriesLabelPosition::UpperLeft,
            LegendPosition::LowerRight => SeriesLabelPosition::LowerRight,
            LegendPosition::LowerLeft => SeriesLabelPosition::LowerLeft,
            LegendPosition::MiddleLeft => SeriesLabelPosition::MiddleLeft,
            LegendPosition::MiddleRight => SeriesLabelPosition::MiddleRight,
        }
    }
}

/// 軸の変換方式
#[derive(Clone, Copy, Serialize, Deserialize, Debug, PartialEq)]
pub enum AxisTransform {
    Linear,
    Log10,
    BiLinear { pos_int: f64, neg_int: f64 },
}

impl Default for AxisTransform {
    fn default() -> Self {
        AxisTransform::Linear
    }
}

impl AxisTransform {
    pub fn forward(&self, v: f64) -> f64 {
        match self {
            AxisTransform::Linear => v,
            AxisTransform::Log10 => {
                if v > 0.0 {
                    v.log10()
                } else {
                    f64::NAN
                }
            }
            AxisTransform::BiLinear { pos_int, neg_int } => {
                let p = if *pos_int != 0.0 { *pos_int } else { 1.0 };
                let n = if *neg_int != 0.0 { *neg_int } else { 1.0 };
                if v >= 0.0 { v / p } else { v / n }
            }
        }
    }

    pub fn inverse(&self, v: f64) -> f64 {
        match self {
            AxisTransform::Linear => v,
            AxisTransform::Log10 => 10f64.powf(v),
            AxisTransform::BiLinear { pos_int, neg_int } => {
                if v >= 0.0 {
                    v * pos_int
                } else {
                    v * neg_int
                }
            }
        }
    }

    pub fn is_bilinear(&self) -> bool {
        matches!(self, AxisTransform::BiLinear { .. })
    }
}

/// 目盛り位置の指定方式
#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum TickMode {
    Explicit(Vec<f64>),
    Interval { base: f64, offset: f64 },
    Auto(usize),
}

impl Default for TickMode {
    fn default() -> Self {
        TickMode::Auto(10)
    }
}

impl TickMode {
    pub fn resolve(&self, min: f64, max: f64) -> Option<Vec<f64>> {
        match self {
            TickMode::Explicit(v) => {
                let mut ticks: Vec<f64> = v
                    .iter()
                    .copied()
                    .filter(|&x| x.is_finite() && x >= min - 1e-9 && x <= max + 1e-9)
                    .collect();
                ticks.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                ticks.dedup();
                Some(ticks)
            }
            TickMode::Interval { base, offset } => {
                if *base <= 0.0 || !base.is_finite() || !min.is_finite() || !max.is_finite() {
                    return None;
                }
                let mut ticks = Vec::new();
                let start_n = ((min - offset) / base).floor() as i64;
                let end_n = ((max - offset) / base).ceil() as i64;
                if (end_n - start_n).unsigned_abs() > 100_000 {
                    return None;
                }
                for n in start_n..=end_n {
                    let t = offset + (n as f64) * base;
                    if t >= min - 1e-9 && t <= max + 1e-9 {
                        ticks.push(t);
                    }
                }
                Some(ticks)
            }
            TickMode::Auto(_) => None,
        }
    }
}

/// 系列ごとの個別スタイル指定（設定JSON用）
#[derive(Clone, Serialize, Deserialize, Debug, Default)]
pub struct SeriesStyleConfig {
    pub label: Option<String>,
    pub color: Option<[u8; 3]>,
    pub marker_type: Option<MarkerType>,
    pub marker_size: Option<u32>,
    pub line_style: Option<LineStyleType>,
    pub line_width: Option<u32>,
    pub use_secondary: Option<bool>,
}

/// 描画する1つの系列データ
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SeriesData {
    pub label: String,
    pub points: Vec<(f64, f64)>,
    pub marker_type: MarkerType,
    pub marker_size: u32,
    pub line_style: LineStyleType,
    pub line_width: u32,

    #[serde(with = "rgb_serde")]
    pub color: RGBColor,

    #[serde(default)]
    pub use_secondary: bool,
}

/// グラフ全体の設定
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
pub struct GraphConfig {
    pub base_font_size: Option<u32>,

    #[serde(default)]
    pub margin: Option<u32>,
    #[serde(default)]
    pub x_label_area: Option<u32>,
    #[serde(default)]
    pub y_label_area: Option<u32>,
    #[serde(default)]
    pub right_margin: Option<u32>,

    pub x_desc: String,
    pub y_desc: String,

    #[serde(default)]
    pub y2_desc: String,

    pub x_range: Range<f64>,
    pub y_range: Range<f64>,
    #[serde(default = "default_range")]
    pub y2_range: Range<f64>,

    pub x_labels: usize,
    pub y_labels: usize,
    #[serde(default)]
    pub y2_labels: usize,

    #[serde(default)]
    pub x_ticks_mode: TickMode,
    #[serde(default)]
    pub y_ticks_mode: TickMode,
    #[serde(default)]
    pub y2_ticks_mode: TickMode,

    pub x_tick_length: u32,
    pub y_tick_length: u32,
    #[serde(default)]
    pub tick_width: Option<f32>,

    pub font_name: String,
    pub x_format_fixed: usize,
    pub y_format_fixed: usize,
    #[serde(default)]
    pub y2_format_fixed: usize,

    pub show_legend: bool,
    #[serde(default)]
    pub legend_position: LegendPosition,
    #[serde(default)]
    pub legend_border_width: Option<f32>,
    #[serde(default)]
    pub legend_background_opacity: Option<f64>,
    #[serde(default)]
    pub legend_margin: Option<u32>,
    #[serde(default)]
    pub legend_area_size: Option<u32>,

    #[serde(default)]
    pub x_transform: AxisTransform,
    #[serde(default)]
    pub y_transform: AxisTransform,
    #[serde(default)]
    pub y2_transform: AxisTransform,

    #[serde(default)]
    pub x_minor_grid_interval: Option<f64>,
    #[serde(default)]
    pub y_minor_grid_interval: Option<f64>,
    #[serde(default)]
    pub y2_minor_grid_interval: Option<f64>,
    #[serde(default)]
    pub minor_grid_width: Option<f32>,
    #[serde(default)]
    pub grid_opacity: Option<f64>,

    #[serde(default)]
    pub use_cross_axes: bool,
    #[serde(default)]
    pub show_cross_border: bool,

    #[serde(default)]
    pub axis_width: Option<f32>,

    #[serde(default)]
    pub series_styles: Vec<SeriesStyleConfig>,
}

impl Default for GraphConfig {
    fn default() -> Self {
        GraphConfig {
            base_font_size: Some(40),
            margin: None,
            x_label_area: None,
            y_label_area: None,
            right_margin: None,
            x_desc: "X Axis".to_string(),
            y_desc: "Y Axis".to_string(),
            y2_desc: String::new(),
            x_range: 0.0..1.0,
            y_range: 0.0..1.0,
            y2_range: 0.0..1.0,
            x_labels: 8,
            y_labels: 8,
            y2_labels: 0,
            x_ticks_mode: TickMode::Auto(8),
            y_ticks_mode: TickMode::Auto(8),
            y2_ticks_mode: TickMode::Auto(8),
            x_tick_length: 10,
            y_tick_length: 10,
            tick_width: Some(3.0),
            font_name: String::new(),
            x_format_fixed: 2,
            y_format_fixed: 2,
            y2_format_fixed: 2,
            show_legend: true,
            legend_position: LegendPosition::UpperRight,
            legend_border_width: Some(3.0),
            legend_background_opacity: Some(0.8),
            legend_margin: None,
            legend_area_size: None,
            x_transform: AxisTransform::Linear,
            y_transform: AxisTransform::Linear,
            y2_transform: AxisTransform::Linear,
            x_minor_grid_interval: None,
            y_minor_grid_interval: None,
            y2_minor_grid_interval: None,
            minor_grid_width: Some(1.0),
            grid_opacity: Some(0.3),
            use_cross_axes: false,
            show_cross_border: false,
            axis_width: Some(3.0),
            series_styles: Vec::new(),
        }
    }
}

fn default_range() -> Range<f64> {
    0.0..1.0
}

mod rgb_serde {
    use plotters::prelude::RGBColor;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(color: &RGBColor, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::Serialize;
        [color.0, color.1, color.2].serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<RGBColor, D::Error>
    where
        D: Deserializer<'de>,
    {
        let [r, g, b]: [u8; 3] = Deserialize::deserialize(deserializer)?;
        Ok(RGBColor(r, g, b))
    }
}

struct PlotSeries<'a> {
    src: &'a SeriesData,
    pts: Vec<(f64, f64)>,
}

fn fix_range(r: Range<f64>) -> Range<f64> {
    if !r.start.is_finite() || !r.end.is_finite() {
        0.0..1.0
    } else if (r.end - r.start).abs() < 1e-9 {
        (r.start - 1.0)..(r.end + 1.0)
    } else if r.start > r.end {
        r.end..r.start
    } else {
        r
    }
}

fn minor_grid_lines(plot_range: &Range<f64>, interval: f64) -> Vec<f64> {
    if interval <= 0.0 || !interval.is_finite() {
        return Vec::new();
    }
    let start_n = (plot_range.start / interval).floor() as i64;
    let end_n = (plot_range.end / interval).ceil() as i64;
    if (end_n - start_n).unsigned_abs() > 100_000 {
        return Vec::new();
    }
    let mut lines = Vec::new();
    for n in start_n..=end_n {
        let v = (n as f64) * interval;
        if v >= plot_range.start && v <= plot_range.end {
            lines.push(v);
        }
    }
    lines
}

fn generate_dashed_segments(
    pts: &[(f64, f64)],
    pattern: &[f64],
    x_span: f64,
    y_span: f64,
    aspect_ratio: f64,
) -> Vec<Vec<(f64, f64)>> {
    if pts.len() < 2 || pattern.is_empty() {
        return vec![pts.to_vec()];
    }

    let mut segments = Vec::new();
    let mut current_segment = Vec::new();
    let mut pattern_idx = 0;
    let mut remaining_in_pattern = pattern[0];
    let mut is_drawing = true;

    for i in 0..pts.len() - 1 {
        let (x0, y0) = pts[i];
        let (x1, y1) = pts[i + 1];
        let dx_norm = (x1 - x0) / x_span;
        let dy_norm = ((y1 - y0) / y_span) * aspect_ratio;
        let seg_len_norm = (dx_norm * dx_norm + dy_norm * dy_norm).sqrt();

        if seg_len_norm <= 1e-9 {
            continue;
        }

        let mut t = 0.0;
        while t < 1.0 - 1e-9 {
            let remaining_dist = (1.0 - t) * seg_len_norm;
            if remaining_dist <= remaining_in_pattern {
                let next_x = x1;
                let next_y = y1;
                if is_drawing {
                    if current_segment.is_empty() {
                        let cur_x = x0 + t * (x1 - x0);
                        let cur_y = y0 + t * (y1 - y0);
                        current_segment.push((cur_x, cur_y));
                    }
                    current_segment.push((next_x, next_y));
                }
                remaining_in_pattern -= remaining_dist;
                t = 1.0;
            } else {
                let step_t = remaining_in_pattern / seg_len_norm;
                let end_t = (t + step_t).min(1.0);
                let next_x = x0 + end_t * (x1 - x0);
                let next_y = y0 + end_t * (y1 - y0);

                if is_drawing {
                    if current_segment.is_empty() {
                        let cur_x = x0 + t * (x1 - x0);
                        let cur_y = y0 + t * (y1 - y0);
                        current_segment.push((cur_x, cur_y));
                    }
                    current_segment.push((next_x, next_y));
                    segments.push(std::mem::take(&mut current_segment));
                }

                t = end_t;
                pattern_idx = (pattern_idx + 1) % pattern.len();
                remaining_in_pattern = pattern[pattern_idx];
                is_drawing = !is_drawing;
            }
        }
    }

    if !current_segment.is_empty() && is_drawing {
        segments.push(current_segment);
    }
    segments
}

/// 描画共通コアロジック
fn render_chart_to_area<DB: DrawingBackend>(
    root: &DrawingArea<DB, plotters::coord::Shift>,
    width: u32,
    height: u32,
    config: &GraphConfig,
    series_list: &[SeriesData],
) -> Result<(), GraphError> {
    root.fill(&WHITE)
        .map_err(|e| GraphError::Drawing(e.to_string()))?;

    let scale_x = width as f64 / 1920.0;
    let scale_y = height as f64 / 1440.0;
    let scale = scale_x.min(scale_y);

    let (font_size_label, font_size_desc) = match config.base_font_size {
        Some(base_size) => {
            let desc_size = (base_size as f64 * (55.0 / 45.0)) as u32;
            (base_size, desc_size)
        }
        None => {
            let label_size = (45.0 * scale) as u32;
            let desc_size = (55.0 * scale) as u32;
            (label_size, desc_size)
        }
    };

    let font_factor = font_size_desc as f64 + font_size_label as f64;
    let auto_x_area = ((110.0 * scale).max(font_factor * 1.6)) as u32;
    let auto_y_area = ((140.0 * scale).max(font_factor * 2.0)) as u32;

    let base_margin = config.margin.unwrap_or(((80.0 * scale) as u32).max(40));
    let x_label_area = config.x_label_area.unwrap_or(auto_x_area);
    let y_label_area = config.y_label_area.unwrap_or(auto_y_area);
    let right_margin = config
        .right_margin
        .unwrap_or(((140.0 * scale) as u32).max(60));

    let (font_desc, font_ticks, font_legend) = if config.font_name.is_empty() {
        (FONT_SERIF, FONT_SANS, FONT_SERIF)
    } else {
        (
            config.font_name.as_str(),
            config.font_name.as_str(),
            config.font_name.as_str(),
        )
    };

    let has_secondary = series_list.iter().any(|s| s.use_secondary);

    let mut primary_series: Vec<PlotSeries> = Vec::new();
    let mut secondary_series: Vec<PlotSeries> = Vec::new();

    let mut x_min = f64::INFINITY;
    let mut x_max = f64::NEG_INFINITY;
    let mut y_min = f64::INFINITY;
    let mut y_max = f64::NEG_INFINITY;
    let mut y2_min = f64::INFINITY;
    let mut y2_max = f64::NEG_INFINITY;

    for s in series_list {
        if s.points.is_empty() {
            continue;
        }
        let is_sec = s.use_secondary && has_secondary;
        let y_transform = if is_sec {
            &config.y2_transform
        } else {
            &config.y_transform
        };

        let mut pts = Vec::with_capacity(s.points.len());
        for &(x, y) in &s.points {
            let tx = config.x_transform.forward(x);
            let ty = y_transform.forward(y);
            if !tx.is_finite() || !ty.is_finite() {
                continue;
            }
            pts.push((tx, ty));
            if tx < x_min {
                x_min = tx;
            }
            if tx > x_max {
                x_max = tx;
            }
            if is_sec {
                if ty < y2_min {
                    y2_min = ty;
                }
                if ty > y2_max {
                    y2_max = ty;
                }
            } else {
                if ty < y_min {
                    y_min = ty;
                }
                if ty > y_max {
                    y_max = ty;
                }
            }
        }
        if pts.is_empty() {
            continue;
        }
        if is_sec {
            secondary_series.push(PlotSeries { src: s, pts });
        } else {
            primary_series.push(PlotSeries { src: s, pts });
        }
    }

    if primary_series.is_empty() && secondary_series.is_empty() {
        return Err(GraphError::InvalidData(
            "描画可能なデータがありません".to_string(),
        ));
    }

    let x_plot_range = fix_range(
        config.x_transform.forward(config.x_range.start)
            ..config.x_transform.forward(config.x_range.end),
    );
    let y_plot_range = fix_range(
        config.y_transform.forward(config.y_range.start)
            ..config.y_transform.forward(config.y_range.end),
    );
    let y2_plot_range = fix_range(if has_secondary {
        config.y2_transform.forward(config.y2_range.start)
            ..config.y2_transform.forward(config.y2_range.end)
    } else {
        0.0..1.0
    });

    let x_span = (x_plot_range.end - x_plot_range.start).abs().max(1e-6);
    let y_span = (y_plot_range.end - y_plot_range.start).abs().max(1e-6);
    let y2_span = (y2_plot_range.end - y2_plot_range.start).abs().max(1e-6);

    let plot_w = (width as f64
        - (base_margin + y_label_area) as f64
        - (if has_secondary {
            y_label_area
        } else if config.show_legend {
            right_margin
        } else {
            base_margin
        }) as f64)
        .max(10.0);
    let plot_h =
        (height as f64 - (base_margin + x_label_area) as f64 - base_margin as f64).max(10.0);
    let aspect_ratio = plot_h / plot_w;

    let mut chart_builder = ChartBuilder::on(root);

    // --- 左右・上下マージンの自動バランシング ---
    if config.use_cross_axes {
        // 十字軸モード: 下・左のエリアを廃止し、均等なマージンで完全に中央配置
        let cross_margin = config.margin.unwrap_or(((90.0 * scale) as u32).max(60));
        chart_builder.margin(cross_margin);
        chart_builder.x_label_area_size(0);
        chart_builder.y_label_area_size(0);
        if config.show_legend {
            chart_builder.margin_right(cross_margin + right_margin / 2);
        }
    } else {
        chart_builder
            .margin(base_margin)
            .x_label_area_size(x_label_area)
            .y_label_area_size(y_label_area);

        if has_secondary {
            chart_builder.right_y_label_area_size(y_label_area);
        } else if config.show_legend {
            chart_builder.margin_right(right_margin);
        } else {
            // 凡例非表示時: 左の y_label_area と釣り合うよう右余白を自動補正して中央揃え
            chart_builder.margin_right(base_margin + y_label_area);
        }
    }

    let mut chart = chart_builder
        .build_cartesian_2d(x_plot_range.clone(), y_plot_range.clone())
        .map_err(|e| GraphError::Drawing(e.to_string()))?
        .set_secondary_coord(x_plot_range.clone(), y2_plot_range.clone());

    let x_digits = config.x_format_fixed;
    let y_digits = config.y_format_fixed;
    let y2_digits = config.y2_format_fixed;

    let x_transform = config.x_transform;
    let y_transform = config.y_transform;
    let y2_transform = config.y2_transform;

    let x_real_min = x_transform.inverse(x_plot_range.start);
    let x_real_max = x_transform.inverse(x_plot_range.end);
    let (x_real_lo, x_real_hi) = (x_real_min.min(x_real_max), x_real_min.max(x_real_max));
    let x_ticks_resolved = config.x_ticks_mode.resolve(x_real_lo, x_real_hi);

    let y_real_min = y_transform.inverse(y_plot_range.start);
    let y_real_max = y_transform.inverse(y_plot_range.end);
    let (y_real_lo, y_real_hi) = (y_real_min.min(y_real_max), y_real_min.max(y_real_max));
    let y_ticks_resolved = config.y_ticks_mode.resolve(y_real_lo, y_real_hi);

    let border_width = (config.axis_width.unwrap_or(6.0) as f64 * scale).max(1.0) as u32;
    let tick_width = (config.tick_width.unwrap_or(3.0) as f64 * scale).max(1.0) as u32;
    let x_tick_len = (config.x_tick_length as f64 * scale).max(2.0) as i32;
    let y_tick_len = (config.y_tick_length as f64 * scale).max(2.0) as i32;

    if config.use_cross_axes {
        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_y_mesh()
            .disable_x_axis()
            .disable_y_axis()
            .draw()
            .map_err(|e| GraphError::Drawing(e.to_string()))?;

        let center_y = if y_plot_range.contains(&0.0) {
            0.0
        } else {
            y_plot_range.start
        };
        let center_x = if x_plot_range.contains(&0.0) {
            0.0
        } else {
            x_plot_range.start
        };

        // 十字軸モード時の外枠描画オプション
        if config.show_cross_border {
            chart
                .draw_series(std::iter::once(Rectangle::new(
                    [
                        (x_plot_range.start, y_plot_range.start),
                        (x_plot_range.end, y_plot_range.end),
                    ],
                    BLACK.mix(0.4).stroke_width((border_width / 2).max(1)),
                )))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }

        if y_plot_range.contains(&0.0) {
            chart
                .draw_series(std::iter::once(PathElement::new(
                    vec![(x_plot_range.start, 0.0), (x_plot_range.end, 0.0)],
                    BLACK.stroke_width(border_width),
                )))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }
        if x_plot_range.contains(&0.0) {
            chart
                .draw_series(std::iter::once(PathElement::new(
                    vec![(0.0, y_plot_range.start), (0.0, y_plot_range.end)],
                    BLACK.stroke_width(border_width),
                )))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }

        // X軸タイトル (Serif: はみ出さない安全位置)
        if !config.x_desc.is_empty() {
            let style = TextStyle::from((font_desc, font_size_desc).into_font())
                .pos(Pos::new(HPos::Right, VPos::Top));
            chart
                .draw_series(std::iter::once(
                    EmptyElement::at((x_plot_range.end, center_y))
                        + Text::new(config.x_desc.clone(), (0, 15), style),
                ))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }

        // Y軸タイトル (Serif: はみ出さない安全位置)
        if !config.y_desc.is_empty() {
            let style = TextStyle::from((font_desc, font_size_desc).into_font())
                .pos(Pos::new(HPos::Left, VPos::Bottom));
            chart
                .draw_series(std::iter::once(
                    EmptyElement::at((center_x, y_plot_range.end))
                        + Text::new(config.y_desc.clone(), (15, 0), style),
                ))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }

        // X軸目盛り線 & ラベル (Sans)
        if let Some(ticks) = &x_ticks_resolved {
            for &tv in ticks {
                let tx = x_transform.forward(tv);
                if tx < x_plot_range.start || tx > x_plot_range.end {
                    continue;
                }
                if y_plot_range.contains(&0.0) {
                    chart
                        .draw_series(std::iter::once(
                            EmptyElement::at((tx, center_y))
                                + PathElement::new(
                                    vec![(0, -x_tick_len / 2), (0, x_tick_len / 2)],
                                    BLACK.stroke_width(tick_width),
                                ),
                        ))
                        .map_err(|e| GraphError::Drawing(e.to_string()))?;
                }

                let label = format!("{:.precision$}", tv, precision = x_digits);
                let (pos, offset) = if tv.abs() < 1e-9 {
                    (Pos::new(HPos::Right, VPos::Top), (-6, 6))
                } else {
                    (Pos::new(HPos::Center, VPos::Top), (0, 12))
                };
                let style = TextStyle::from((font_ticks, font_size_label).into_font()).pos(pos);

                chart
                    .draw_series(std::iter::once(
                        EmptyElement::at((tx, center_y)) + Text::new(label, offset, style),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }

        // Y軸目盛り線 & ラベル (Sans)
        if let Some(ticks) = &y_ticks_resolved {
            for &tv in ticks {
                let ty = y_transform.forward(tv);
                if ty < y_plot_range.start || ty > y_plot_range.end {
                    continue;
                }
                if x_plot_range.contains(&0.0) {
                    chart
                        .draw_series(std::iter::once(
                            EmptyElement::at((center_x, ty))
                                + PathElement::new(
                                    vec![(-y_tick_len / 2, 0), (y_tick_len / 2, 0)],
                                    BLACK.stroke_width(tick_width),
                                ),
                        ))
                        .map_err(|e| GraphError::Drawing(e.to_string()))?;
                }

                if tv.abs() < 1e-9 {
                    continue;
                }
                let label = format!("{:.precision$}", tv, precision = y_digits);
                let style = TextStyle::from((font_ticks, font_size_label).into_font())
                    .pos(Pos::new(HPos::Right, VPos::Center));

                chart
                    .draw_series(std::iter::once(
                        EmptyElement::at((center_x, ty)) + Text::new(label, (-15, 0), style),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }
    } else {
        let x_fmt = |x: &f64| {
            let v = x_transform.inverse(*x);
            format!("{:.precision$}", v, precision = x_digits)
        };
        let y_fmt = |y: &f64| {
            let v = y_transform.inverse(*y);
            format!("{:.precision$}", v, precision = y_digits)
        };
        let mut mesh = chart.configure_mesh();
        mesh.x_desc(&config.x_desc)
            .y_desc(&config.y_desc)
            .axis_desc_style((font_desc, font_size_desc))
            .label_style((font_ticks, font_size_label))
            .axis_style(TRANSPARENT)
            .disable_x_mesh()
            .disable_y_mesh()
            .bold_line_style(BLACK.mix(0.2).stroke_width(2))
            .light_line_style(TRANSPARENT)
            .set_all_tick_mark_size((20.0 * scale) as u32)
            .x_label_formatter(&x_fmt)
            .y_label_formatter(&y_fmt);

        match &x_ticks_resolved {
            Some(ticks) => {
                mesh.x_labels(ticks.len().max(1));
            }
            None => {
                mesh.x_labels(config.x_labels);
            }
        }
        match &y_ticks_resolved {
            Some(ticks) => {
                mesh.y_labels(ticks.len().max(1));
            }
            None => {
                mesh.y_labels(config.y_labels);
            }
        }

        mesh.draw()
            .map_err(|e| GraphError::Drawing(e.to_string()))?;

        // 標準外枠モードの外枠
        chart
            .draw_series(std::iter::once(Rectangle::new(
                [
                    (x_plot_range.start, y_plot_range.start),
                    (x_plot_range.end, y_plot_range.end),
                ],
                BLACK.stroke_width(border_width),
            )))
            .map_err(|e| GraphError::Drawing(e.to_string()))?;

        // 内向き目盛り線
        if let Some(ticks) = &x_ticks_resolved {
            for &tv in ticks {
                let tx = x_transform.forward(tv);
                if tx < x_plot_range.start || tx > x_plot_range.end {
                    continue;
                }
                chart
                    .draw_series(std::iter::once(
                        EmptyElement::at((tx, y_plot_range.start))
                            + PathElement::new(
                                vec![(0, 0), (0, -x_tick_len)],
                                BLACK.stroke_width(tick_width),
                            ),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }

        if let Some(ticks) = &y_ticks_resolved {
            for &tv in ticks {
                let ty = y_transform.forward(tv);
                if ty < y_plot_range.start || ty > y_plot_range.end {
                    continue;
                }
                chart
                    .draw_series(std::iter::once(
                        EmptyElement::at((x_plot_range.start, ty))
                            + PathElement::new(
                                vec![(0, 0), (y_tick_len, 0)],
                                BLACK.stroke_width(tick_width),
                            ),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }
    }

    // 補助グリッド
    let grid_width = (config.minor_grid_width.unwrap_or(1.0) as f64 * scale).max(1.0) as u32;
    let grid_opacity = config.grid_opacity.unwrap_or(0.3).clamp(0.0, 1.0);

    if let Some(interval) = config.x_minor_grid_interval {
        for tx in minor_grid_lines(&x_plot_range, interval) {
            chart
                .draw_series(std::iter::once(PathElement::new(
                    vec![(tx, y_plot_range.start), (tx, y_plot_range.end)],
                    BLACK.mix(grid_opacity).stroke_width(grid_width),
                )))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }
    }
    if let Some(interval) = config.y_minor_grid_interval {
        for ty in minor_grid_lines(&y_plot_range, interval) {
            chart
                .draw_series(std::iter::once(PathElement::new(
                    vec![(x_plot_range.start, ty), (x_plot_range.end, ty)],
                    BLACK.mix(grid_opacity).stroke_width(grid_width),
                )))
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }
    }

    // 第2軸
    if has_secondary {
        let y2_real_min = y2_transform.inverse(y2_plot_range.start);
        let y2_real_max = y2_transform.inverse(y2_plot_range.end);
        let (y2_real_lo, y2_real_hi) = (y2_real_min.min(y2_real_max), y2_real_min.max(y2_real_max));
        let y2_ticks_resolved = config.y2_ticks_mode.resolve(y2_real_lo, y2_real_hi);

        {
            let y2_fmt = |y: &f64| {
                let v = y2_transform.inverse(*y);
                format!("{:.precision$}", v, precision = y2_digits)
            };
            let mut mesh2 = chart.configure_secondary_axes();
            mesh2
                .y_desc(&config.y2_desc)
                .axis_desc_style((font_desc, font_size_desc))
                .label_style((font_ticks, font_size_label))
                .y_label_formatter(&y2_fmt);
            match &y2_ticks_resolved {
                Some(ticks) => {
                    mesh2.y_labels(ticks.len().max(1));
                }
                None => {
                    mesh2.y_labels(config.y2_labels.max(1));
                }
            }
            mesh2
                .draw()
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }

        if let Some(interval) = config.y2_minor_grid_interval {
            for ty in minor_grid_lines(&y2_plot_range, interval) {
                chart
                    .draw_secondary_series(std::iter::once(PathElement::new(
                        vec![(x_plot_range.start, ty), (x_plot_range.end, ty)],
                        BLACK.mix(grid_opacity).stroke_width(grid_width),
                    )))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }

        for series in &secondary_series {
            draw_one_series_secondary(
                &mut chart,
                series,
                config.show_legend,
                x_span,
                y2_span,
                aspect_ratio,
            )?;
        }
    }

    for series in &primary_series {
        draw_one_series_primary(
            &mut chart,
            series,
            config.show_legend,
            x_span,
            y_span,
            aspect_ratio,
        )?;
    }

    // 凡例 (Serif)
    if config.show_legend {
        let pos: SeriesLabelPosition = config.legend_position.into();
        let leg_border = (config.legend_border_width.unwrap_or(3.0) as f64 * scale).max(1.0) as u32;
        let leg_bg_opacity = config
            .legend_background_opacity
            .unwrap_or(0.8)
            .clamp(0.0, 1.0);
        let leg_margin = config
            .legend_margin
            .unwrap_or(((20.0 * scale) as u32).max(5));
        let leg_area = config
            .legend_area_size
            .unwrap_or(((50.0 * scale) as u32).max(20));

        chart
            .configure_series_labels()
            .background_style(&WHITE.mix(leg_bg_opacity))
            .border_style(BLACK.stroke_width(leg_border))
            .label_font((font_legend, font_size_label))
            .position(pos)
            .margin(leg_margin)
            .legend_area_size(leg_area)
            .draw()
            .map_err(|e| GraphError::Drawing(e.to_string()))?;
    }

    root.present()
        .map_err(|e| GraphError::Drawing(e.to_string()))?;

    Ok(())
}

/// ラスタ画像（生RGBバッファ）の生成
pub fn generate_graph_image(
    width: u32,
    height: u32,
    config: &GraphConfig,
    series_list: &[SeriesData],
) -> Result<Vec<u8>, GraphError> {
    if width == 0 || height == 0 {
        return Err(GraphError::InvalidData(
            "画像の幅および高さは1px以上を指定してください".to_string(),
        ));
    }

    ensure_font_registered()?;

    let mut buf = vec![0u8; (width * height * 3) as usize];
    {
        let root = BitMapBackend::with_buffer(&mut buf, (width, height)).into_drawing_area();
        render_chart_to_area(&root, width, height, config, series_list)?;
    }

    Ok(buf)
}

/// ベクター画像（SVG 文字列）の生成
pub fn generate_graph_svg(
    width: u32,
    height: u32,
    config: &GraphConfig,
    series_list: &[SeriesData],
) -> Result<String, GraphError> {
    if width == 0 || height == 0 {
        return Err(GraphError::InvalidData(
            "画像の幅および高さは1px以上を指定してください".to_string(),
        ));
    }

    ensure_font_registered()?;

    let mut svg_buffer = String::new();
    {
        let root = SVGBackend::with_string(&mut svg_buffer, (width, height)).into_drawing_area();
        render_chart_to_area(&root, width, height, config, series_list)?;
    }

    Ok(svg_buffer)
}

macro_rules! define_draw_series_fn {
    ($fn_name:ident, $draw_method:ident) => {
        fn $fn_name<'a, DB, X, Y, SX, SY>(
            chart: &mut DualCoordChartContext<'a, DB, Cartesian2d<X, Y>, Cartesian2d<SX, SY>>,
            series: &PlotSeries,
            show_legend: bool,
            x_span: f64,
            y_span: f64,
            aspect_ratio: f64,
        ) -> Result<(), GraphError>
        where
            DB: DrawingBackend + 'a,
            X: Ranged<ValueType = f64>,
            Y: Ranged<ValueType = f64>,
            SX: Ranged<ValueType = f64>,
            SY: Ranged<ValueType = f64>,
        {
            let s = series.src;
            let color = s.color;
            let size = s.marker_size;
            let l_width = s.line_width;
            let l_style = s.line_style;
            let m_type = s.marker_type;

            let has_line = l_style != LineStyleType::None && series.pts.len() >= 2;
            let has_marker = m_type != MarkerType::None && !series.pts.is_empty();
            let should_register_legend =
                show_legend && !s.label.is_empty() && (has_line || has_marker);
            let mut legend_registered = false;

            let make_legend_icon = move |(x, y): (i32, i32)| {
                let dummy_path = vec![(0, 0), (0, 0)];
                let line_stroke = color.stroke_width(l_width);
                let no_stroke = TRANSPARENT.stroke_width(0);

                let (p1, s1, p2, s2, p3, s3, p4, s4) = match l_style {
                    LineStyleType::Solid => (
                        vec![(0, 0), (30, 0)],
                        line_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                    ),
                    LineStyleType::Dashed => (
                        vec![(0, 0), (12, 0)],
                        line_stroke,
                        vec![(18, 0), (30, 0)],
                        line_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                    ),
                    LineStyleType::Dotted => (
                        vec![(0, 0), (4, 0)],
                        line_stroke,
                        vec![(9, 0), (13, 0)],
                        line_stroke,
                        vec![(18, 0), (22, 0)],
                        line_stroke,
                        vec![(26, 0), (30, 0)],
                        line_stroke,
                    ),
                    LineStyleType::DashDot => (
                        vec![(0, 0), (14, 0)],
                        line_stroke,
                        vec![(20, 0), (22, 0)],
                        line_stroke,
                        vec![(27, 0), (30, 0)],
                        line_stroke,
                        dummy_path.clone(),
                        no_stroke,
                    ),
                    LineStyleType::None => (
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                    ),
                };

                let cross_sz = size as i32;
                let (c1, cs1, c2, cs2, circ_r, circ_style) = match m_type {
                    MarkerType::CircleFilled => (
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        size,
                        color.filled(),
                    ),
                    MarkerType::CircleEmpty => (
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        size,
                        color.stroke_width(2),
                    ),
                    MarkerType::Cross => (
                        vec![(15 - cross_sz, 0), (15 + cross_sz, 0)],
                        color.stroke_width(2),
                        vec![(15, -cross_sz), (15, cross_sz)],
                        color.stroke_width(2),
                        0,
                        no_stroke,
                    ),
                    MarkerType::None => (
                        dummy_path.clone(),
                        no_stroke,
                        dummy_path.clone(),
                        no_stroke,
                        0,
                        no_stroke,
                    ),
                };

                EmptyElement::at((x, y))
                    + PathElement::new(p1, s1)
                    + PathElement::new(p2, s2)
                    + PathElement::new(p3, s3)
                    + PathElement::new(p4, s4)
                    + PathElement::new(c1, cs1)
                    + PathElement::new(c2, cs2)
                    + Circle::new((15, 0), circ_r, circ_style)
            };

            // 1. 線の描画
            if has_line {
                let pattern: Option<&[f64]> = match l_style {
                    LineStyleType::Solid => None,
                    LineStyleType::Dashed => Some(&[0.025, 0.015]),
                    LineStyleType::Dotted => Some(&[0.005, 0.010]),
                    LineStyleType::DashDot => Some(&[0.025, 0.010, 0.005, 0.010]),
                    LineStyleType::None => unreachable!(),
                };

                let segments: Vec<Vec<(f64, f64)>> = if let Some(pat) = pattern {
                    generate_dashed_segments(&series.pts, pat, x_span, y_span, aspect_ratio)
                } else {
                    vec![series.pts.clone()]
                };

                for seg in segments {
                    if seg.is_empty() {
                        continue;
                    }
                    let line = LineSeries::new(seg.into_iter(), color.stroke_width(l_width));
                    if should_register_legend && !legend_registered {
                        chart
                            .$draw_method(line)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?
                            .label(&s.label)
                            .legend(make_legend_icon);
                        legend_registered = true;
                    } else {
                        chart
                            .$draw_method(line)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?;
                    }
                }
            }

            // 2. マーカーの描画
            if has_marker {
                let m_series_iter = series.pts.iter().cloned();
                match m_type {
                    MarkerType::CircleFilled => {
                        let m_series =
                            m_series_iter.map(|(x, y)| Circle::new((x, y), size, color.filled()));
                        if should_register_legend && !legend_registered {
                            chart
                                .$draw_method(m_series)
                                .map_err(|e| GraphError::Drawing(e.to_string()))?
                                .label(&s.label)
                                .legend(make_legend_icon);
                        } else {
                            chart
                                .$draw_method(m_series)
                                .map_err(|e| GraphError::Drawing(e.to_string()))?;
                        }
                    }
                    MarkerType::CircleEmpty => {
                        let m_series = m_series_iter
                            .map(|(x, y)| Circle::new((x, y), size, color.stroke_width(2)));
                        if should_register_legend && !legend_registered {
                            chart
                                .$draw_method(m_series)
                                .map_err(|e| GraphError::Drawing(e.to_string()))?
                                .label(&s.label)
                                .legend(make_legend_icon);
                        } else {
                            chart
                                .$draw_method(m_series)
                                .map_err(|e| GraphError::Drawing(e.to_string()))?;
                        }
                    }
                    MarkerType::Cross => {
                        let m_series = m_series_iter
                            .map(|(x, y)| Cross::new((x, y), size, color.stroke_width(2)));
                        if should_register_legend && !legend_registered {
                            chart
                                .$draw_method(m_series)
                                .map_err(|e| GraphError::Drawing(e.to_string()))?
                                .label(&s.label)
                                .legend(make_legend_icon);
                        } else {
                            chart
                                .$draw_method(m_series)
                                .map_err(|e| GraphError::Drawing(e.to_string()))?;
                        }
                    }
                    MarkerType::None => {}
                }
            }

            Ok(())
        }
    };
}

define_draw_series_fn!(draw_one_series_primary, draw_series);
define_draw_series_fn!(draw_one_series_secondary, draw_secondary_series);
