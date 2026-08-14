use plotters::chart::DualCoordChartContext;
use plotters::coord::cartesian::Cartesian2d;
use plotters::coord::ranged1d::Ranged;
use plotters::prelude::*;
use plotters::style::{
    TextStyle,
    text_anchor::{HPos, Pos, VPos},
};
use serde::{Deserialize, Serialize};
use std::ops::Range;

/// グラフ描画に関するエラー
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

/// マーカーの形状
#[derive(Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MarkerType {
    CircleFilled,
    CircleEmpty,
    Cross,
    None,
}

/// 軸の変換方式（Python版の use_log_*, use_bl_* に相当）
#[derive(Clone, Copy, Serialize, Deserialize)]
pub enum AxisTransform {
    /// 線形（変換なし）
    Linear,
    /// 常用対数（値は正である必要がある。0以下の値を持つ点はスキップされる）
    Log10,
    /// 双線形（正負で異なる除数を使い、原点対称に自動スケーリングする）
    BiLinear { pos_int: f64, neg_int: f64 },
}

impl Default for AxisTransform {
    fn default() -> Self {
        AxisTransform::Linear
    }
}

impl AxisTransform {
    /// 実データ値 -> 描画座標値
    fn forward(&self, v: f64) -> f64 {
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

    /// 描画座標値 -> 実データ値（目盛りラベル表示用の逆変換）
    fn inverse(&self, v: f64) -> f64 {
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

    fn is_bilinear(&self) -> bool {
        matches!(self, AxisTransform::BiLinear { .. })
    }
}

/// 目盛り位置の指定方式
#[derive(Clone, Serialize, Deserialize)]
pub enum TickMode {
    /// 実データ値で明示的に位置を列挙する
    Explicit(Vec<f64>),
    /// 間隔 + オフセットで自動生成する
    Interval { base: f64, offset: f64 },
    /// plottersの自動配置に任せる（本数のみのヒント）
    Auto(usize),
}

impl Default for TickMode {
    fn default() -> Self {
        TickMode::Auto(10)
    }
}

impl TickMode {
    /// 実データ範囲 [min, max] に対して、実際の目盛り位置（実データ値）を解決する。
    fn resolve(&self, min: f64, max: f64) -> Option<Vec<f64>> {
        match self {
            TickMode::Explicit(v) => Some(v.clone()),
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

/// 描画する1つの系列データ
#[derive(Clone, Serialize, Deserialize)]
pub struct SeriesData {
    pub label: String,
    pub points: Vec<(f64, f64)>,
    pub marker_type: MarkerType,
    pub marker_size: u32,
    pub draw_line: bool,
    pub line_width: u32,

    #[serde(with = "rgb_serde")]
    pub color: RGBColor,

    /// true の場合、この系列は第2Y軸（右軸）に描画される
    #[serde(default)]
    pub use_secondary: bool,
}

/// グラフ全体の配置・軸設定
#[derive(Serialize, Deserialize)]
pub struct GraphConfig {
    pub base_font_size: Option<u32>, // フォントサイズ

    pub x_desc: String,
    pub y_desc: String,

    /// 第2軸のラベル
    #[serde(default)]
    pub y2_desc: String,

    pub x_range: Range<f64>,
    pub y_range: Range<f64>,
    #[serde(default = "default_range")]
    pub y2_range: Range<f64>,

    /// TickModeが Auto の場合に使う目盛り本数のフォールバック
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

    pub x_tick_length: u32, // ピクセル単位
    pub y_tick_length: u32, // ピクセル単位

    pub font_name: String,
    pub x_format_fixed: usize,
    pub y_format_fixed: usize,
    #[serde(default)]
    pub y2_format_fixed: usize,

    pub show_legend: bool,

    // --- 軸変換（対数・双線形） ---
    #[serde(default)]
    pub x_transform: AxisTransform,
    #[serde(default)]
    pub y_transform: AxisTransform,
    #[serde(default)]
    pub y2_transform: AxisTransform,

    // --- 補助グリッド線（間隔指定。描画座標＝変換後の単位で指定） ---
    #[serde(default)]
    pub x_minor_grid_interval: Option<f64>,
    #[serde(default)]
    pub y_minor_grid_interval: Option<f64>,
    #[serde(default)]
    pub y2_minor_grid_interval: Option<f64>,

    // --- 十字軸モード ---
    #[serde(default)]
    pub use_cross_axes: bool,

    // --- 軸・外枠の太さ ---
    #[serde(default)]
    pub axis_width: Option<f32>,

    #[serde(default)]
    pub minor_grid_width: Option<f32>,
}

fn default_range() -> Range<f64> {
    0.0..1.0
}

mod rgb_serde {
    use plotters::prelude::RGBColor;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S>(color: &RGBColor, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
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

/// 変換済み系列（プロット座標）
struct PlotSeries<'a> {
    src: &'a SeriesData,
    pts: Vec<(f64, f64)>,
}

/// データの [min, max] を原点対称にした Range を計算する
fn centered_range(vmin: f64, vmax: f64) -> Range<f64> {
    if !vmin.is_finite() || !vmax.is_finite() {
        return -1.0..1.0;
    }
    let mut limit = vmin.abs().max(vmax.abs());
    if limit == 0.0 {
        limit = 1.0;
    }
    limit *= 1.1;
    -limit..limit
}

/// 不正な範囲（NaN・start>=end）をフォールバックする
fn fix_range(r: Range<f64>) -> Range<f64> {
    if !r.start.is_finite() || !r.end.is_finite() || r.start >= r.end {
        0.0..1.0
    } else {
        r
    }
}

/// 実データ範囲[min,max]に対して、interval間隔の補助グリッド線位置（描画座標）を生成する
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

/// 汎用グラフ描画関数
pub fn generate_graph_image(
    width: u32,
    height: u32,
    config: &GraphConfig,
    series_list: &[SeriesData],
) -> Result<Vec<u8>, GraphError> {
    let scale_x = width as f64 / 1920.0;
    let scale_y = height as f64 / 1440.0;
    let scale = scale_x.min(scale_y);

    let base_margin = (80.0 * scale) as u32;
    let x_label_area = (130.0 * scale) as u32;
    let y_label_area = (170.0 * scale) as u32;
    let right_margin = (140.0 * scale) as u32;

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

    let has_secondary = series_list.iter().any(|s| s.use_secondary);

    // --- 各系列を軸変換してプロット座標に投影しつつ、範囲を収集する ---
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
            "描画可能なデータがありません（対数軸で正の値が無い等）".to_string(),
        ));
    }

    // --- 軸範囲の決定 ---
    let x_plot_range = fix_range(if config.x_transform.is_bilinear() {
        centered_range(x_min, x_max)
    } else {
        config.x_transform.forward(config.x_range.start)
            ..config.x_transform.forward(config.x_range.end)
    });

    let y_plot_range = fix_range(if config.y_transform.is_bilinear() {
        centered_range(y_min, y_max)
    } else {
        config.y_transform.forward(config.y_range.start)
            ..config.y_transform.forward(config.y_range.end)
    });

    let y2_plot_range = fix_range(if has_secondary {
        if config.y2_transform.is_bilinear() {
            centered_range(y2_min, y2_max)
        } else {
            config.y2_transform.forward(config.y2_range.start)
                ..config.y2_transform.forward(config.y2_range.end)
        }
    } else {
        0.0..1.0
    });

    let mut buf = vec![0u8; (width * height * 3) as usize];

    {
        let root = BitMapBackend::with_buffer(&mut buf, (width, height)).into_drawing_area();
        root.fill(&WHITE)
            .map_err(|e| GraphError::Drawing(e.to_string()))?;

        let mut chart_builder = ChartBuilder::on(&root);
        chart_builder
            .margin(base_margin)
            .x_label_area_size(x_label_area)
            .y_label_area_size(y_label_area);

        if config.show_legend || has_secondary {
            chart_builder.margin_right(right_margin);
        }
        if has_secondary {
            chart_builder.right_y_label_area_size(y_label_area);
        }

        let mut chart = chart_builder
            .build_cartesian_2d(x_plot_range.clone(), y_plot_range.clone())
            .map_err(|e| GraphError::Drawing(e.to_string()))?
            .set_secondary_coord(x_plot_range.clone(), y2_plot_range.clone());

        let font = config.font_name.as_str();
        let x_digits = config.x_format_fixed;
        let y_digits = config.y_format_fixed;
        let y2_digits = config.y2_format_fixed;

        let x_transform = config.x_transform;
        let y_transform = config.y_transform;
        let y2_transform = config.y2_transform;

        // 実データ単位での目盛り解決
        let x_real_min = x_transform.inverse(x_plot_range.start);
        let x_real_max = x_transform.inverse(x_plot_range.end);
        let (x_real_lo, x_real_hi) = (x_real_min.min(x_real_max), x_real_min.max(x_real_max));
        let x_ticks_resolved = config.x_ticks_mode.resolve(x_real_lo, x_real_hi);

        let y_real_min = y_transform.inverse(y_plot_range.start);
        let y_real_max = y_transform.inverse(y_plot_range.end);
        let (y_real_lo, y_real_hi) = (y_real_min.min(y_real_max), y_real_min.max(y_real_max));
        let y_ticks_resolved = config.y_ticks_mode.resolve(y_real_lo, y_real_hi);

        if config.use_cross_axes {
            // --- 十字軸モード ---
            chart
                .configure_mesh()
                .disable_x_mesh()
                .disable_y_mesh()
                .disable_x_axis()
                .disable_y_axis()
                .draw()
                .map_err(|e| GraphError::Drawing(e.to_string()))?;

            let border_width = (config.axis_width.unwrap_or(6.0) as f64 * scale).max(1.0) as u32;

            // 中央の十字線の位置
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

            // ① X軸のタイトル用 (外枠の右下外側に配置)
            if !config.x_desc.is_empty() {
                let style = TextStyle::from((font, font_size_desc).into_font())
                    .pos(Pos::new(HPos::Left, VPos::Top));
                chart
                    .draw_series(std::iter::once(
                        EmptyElement::at((x_plot_range.end, y_plot_range.start))
                            + Text::new(config.x_desc.clone(), (10, 10), style),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }

            // ② Y軸のタイトル用
            if !config.y_desc.is_empty() {
                let style = TextStyle::from((font, font_size_desc).into_font())
                    .pos(Pos::new(HPos::Right, VPos::Bottom));
                chart
                    .draw_series(std::iter::once(
                        EmptyElement::at((center_x, y_plot_range.end))
                            + Text::new(config.y_desc.clone(), (-15, -15), style),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }

            // ③ X軸の目盛り数字用
            if let Some(ticks) = &x_ticks_resolved {
                for &tv in ticks {
                    let tx = x_transform.forward(tv);

                    if tx < x_plot_range.start || tx > x_plot_range.end {
                        continue;
                    }

                    let label = format!("{:.precision$}", tv, precision = x_digits);

                    // 0.0のときだけ配置を「右揃え」にして左下にずらす
                    let (pos, offset) = if tv.abs() < 1e-9 {
                        (Pos::new(HPos::Right, VPos::Top), (-6, 6))
                    } else {
                        (Pos::new(HPos::Center, VPos::Top), (0, 12))
                    };

                    let style = TextStyle::from((font, font_size_label).into_font()).pos(pos);

                    chart
                        .draw_series(std::iter::once(
                            EmptyElement::at((tx, center_y)) + Text::new(label, offset, style),
                        ))
                        .map_err(|e| GraphError::Drawing(e.to_string()))?;
                }
            }

            // ④ Y軸の目盛り数字用
            if let Some(ticks) = &y_ticks_resolved {
                for &tv in ticks {
                    let ty = y_transform.forward(tv);

                    if ty < y_plot_range.start || ty > y_plot_range.end {
                        continue;
                    }

                    // 縦軸の0は非表示（スキップ）にする
                    if tv.abs() < 1e-9 {
                        continue;
                    }

                    let label = format!("{:.precision$}", tv, precision = y_digits);

                    let style = TextStyle::from((font, font_size_label).into_font())
                        .pos(Pos::new(HPos::Right, VPos::Center));
                    chart
                        .draw_series(std::iter::once(
                            EmptyElement::at((center_x, ty)) + Text::new(label, (-15, 0), style),
                        ))
                        .map_err(|e| GraphError::Drawing(e.to_string()))?;
                }
            }
        } else {
            // --- 通常モード ---
            {
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
                    .axis_desc_style((font, font_size_desc))
                    .label_style((font, font_size_label))
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
            }
        }

        // 外枠
        let border_width = (config.axis_width.unwrap_or(6.0) as f64 * scale).max(1.0) as u32;
        chart
            .draw_series(std::iter::once(Rectangle::new(
                [
                    (x_plot_range.start, y_plot_range.start),
                    (x_plot_range.end, y_plot_range.end),
                ],
                BLACK.stroke_width(border_width),
            )))
            .map_err(|e| GraphError::Drawing(e.to_string()))?;

        let tick_width = (3.0 * scale).max(1.0) as u32;

        // 内向き目盛り（X軸）
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
                                vec![(0, 0), (0, -(config.x_tick_length as i32))],
                                BLACK.stroke_width(tick_width),
                            ),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }

        // 内向き目盛り（Y軸）
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
                                vec![(0, 0), (config.y_tick_length as i32, 0)],
                                BLACK.stroke_width(tick_width),
                            ),
                    ))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }

        // --- 補助グリッド線 ---
        let grid_width = (config.minor_grid_width.unwrap_or(1.0) as f64 * scale).max(1.0) as u32;

        if let Some(interval) = config.x_minor_grid_interval {
            for tx in minor_grid_lines(&x_plot_range, interval) {
                chart
                    .draw_series(std::iter::once(PathElement::new(
                        vec![(tx, y_plot_range.start), (tx, y_plot_range.end)],
                        BLACK.mix(0.3).stroke_width(grid_width), // ★ grid_width に変更
                    )))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }
        if let Some(interval) = config.y_minor_grid_interval {
            for ty in minor_grid_lines(&y_plot_range, interval) {
                chart
                    .draw_series(std::iter::once(PathElement::new(
                        vec![(x_plot_range.start, ty), (x_plot_range.end, ty)],
                        BLACK.mix(0.3).stroke_width(grid_width), // ★ grid_width に変更
                    )))
                    .map_err(|e| GraphError::Drawing(e.to_string()))?;
            }
        }

        // --- 第2軸のメッシュ・枠・目盛りラベル ---
        if has_secondary {
            let y2_real_min = y2_transform.inverse(y2_plot_range.start);
            let y2_real_max = y2_transform.inverse(y2_plot_range.end);
            let (y2_real_lo, y2_real_hi) =
                (y2_real_min.min(y2_real_max), y2_real_min.max(y2_real_max));
            let y2_ticks_resolved = config.y2_ticks_mode.resolve(y2_real_lo, y2_real_hi);

            {
                let y2_fmt = |y: &f64| {
                    let v = y2_transform.inverse(*y);
                    format!("{:.precision$}", v, precision = y2_digits)
                };
                let mut mesh2 = chart.configure_secondary_axes();
                mesh2
                    .y_desc(&config.y2_desc)
                    .axis_desc_style((font, font_size_desc))
                    .label_style((font, font_size_label))
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
                            BLACK.mix(0.3).stroke_width(grid_width), // ★ grid_width に変更
                        )))
                        .map_err(|e| GraphError::Drawing(e.to_string()))?;
                }
            }

            for series in &secondary_series {
                draw_one_series_secondary(&mut chart, series, config.show_legend)?;
            }
        }

        // --- 主軸系列の描画 ---
        for series in &primary_series {
            draw_one_series_primary(&mut chart, series, config.show_legend)?;
        }

        if config.show_legend {
            chart
                .configure_series_labels()
                .background_style(&WHITE.mix(0.8))
                .border_style(BLACK.stroke_width(3))
                .label_font((font, font_size_label))
                .position(SeriesLabelPosition::UpperRight)
                .margin((20.0 * scale) as u32)
                .legend_area_size((50.0 * scale) as u32)
                .draw()
                .map_err(|e| GraphError::Drawing(e.to_string()))?;
        }

        root.present()
            .map_err(|e| GraphError::Drawing(e.to_string()))?;
    }

    Ok(buf)
}

macro_rules! define_draw_series_fn {
    ($fn_name:ident, $draw_method:ident) => {
        fn $fn_name<DB, X, Y, SX, SY>(
            chart: &mut DualCoordChartContext<'_, DB, Cartesian2d<X, Y>, Cartesian2d<SX, SY>>,
            series: &PlotSeries,
            show_legend: bool,
        ) -> Result<(), GraphError>
        where
            DB: DrawingBackend,
            X: Ranged<ValueType = f64>,
            Y: Ranged<ValueType = f64>,
            SX: Ranged<ValueType = f64>,
            SY: Ranged<ValueType = f64>,
        {
            let s = series.src;
            let color = s.color;
            let size = s.marker_size;
            let l_width = s.line_width;

            if s.draw_line {
                let line_series =
                    LineSeries::new(series.pts.iter().copied(), color.stroke_width(l_width));
                if show_legend && !s.label.is_empty() {
                    chart
                        .$draw_method(line_series)
                        .map_err(|e| GraphError::Drawing(e.to_string()))?
                        .label(s.label.clone())
                        .legend(move |(x, y)| {
                            PathElement::new(vec![(x, y), (x + 30, y)], color.stroke_width(l_width))
                        });
                } else {
                    chart
                        .$draw_method(line_series)
                        .map_err(|e| GraphError::Drawing(e.to_string()))?;
                }
            }

            match s.marker_type {
                MarkerType::CircleFilled => {
                    let m_series = series
                        .pts
                        .iter()
                        .map(|&(x, y)| Circle::new((x, y), size, color.filled()));
                    if show_legend && !s.label.is_empty() && !s.draw_line {
                        chart
                            .$draw_method(m_series)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?
                            .label(&s.label)
                            .legend(move |(x, y)| {
                                Circle::new((x + 30 - size as i32, y), size, color.filled())
                            });
                    } else {
                        chart
                            .$draw_method(m_series)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?;
                    }
                }
                MarkerType::CircleEmpty => {
                    let m_series = series
                        .pts
                        .iter()
                        .map(|&(x, y)| Circle::new((x, y), size, color.stroke_width(3)));
                    if show_legend && !s.label.is_empty() {
                        chart
                            .$draw_method(m_series)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?
                            .label(&s.label)
                            .legend(move |(x, y)| {
                                Circle::new((x + 30 - size as i32, y), size, color.stroke_width(3))
                            });
                    } else {
                        chart
                            .$draw_method(m_series)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?;
                    }
                }
                MarkerType::Cross => {
                    let m_series = series
                        .pts
                        .iter()
                        .map(|&(x, y)| Cross::new((x, y), size, color.stroke_width(3)));
                    if show_legend && !s.label.is_empty() {
                        chart
                            .$draw_method(m_series)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?
                            .label(&s.label)
                            .legend(move |(x, y)| {
                                Cross::new((x + 30 - size as i32, y), size, color.stroke_width(3))
                            });
                    } else {
                        chart
                            .$draw_method(m_series)
                            .map_err(|e| GraphError::Drawing(e.to_string()))?;
                    }
                }
                MarkerType::None => {}
            }

            Ok(())
        }
    };
}

define_draw_series_fn!(draw_one_series_primary, draw_series);
define_draw_series_fn!(draw_one_series_secondary, draw_secondary_series);
