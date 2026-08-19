# 322

use tab2plot_lib::{generate_graph_image, GraphConfig, MarkerType, SeriesData, TickMode, AxisTransform};
use plotters::prelude::RGBColor;
use std::fs::File;
use std::io::BufWriter;

fn main() -> Result<(), Box<dyn std::error::Error>> {
// 4つのデータセット定義
let datasets = vec![
(
"095647",
vec![
                (0.0, 4.0), (1.0, 4.0), (2.0, 86.0), (3.0, 128.0), (4.0, 156.0),
                (5.0, 202.0), (6.0, 296.0), (7.0, 359.0), (8.0, 421.0), (9.0, 483.0),
                (10.0, 524.0), (11.0, 564.0), (12.0, 617.0), (13.0, 683.0), (14.0, 740.0),
                (15.0, 804.0), (16.0, 845.0), (17.0, 898.0), (18.0, 938.0), (19.0, 1023.0),
                (20.0, 1023.0)
            ]
),
(
"095836",
vec![
                (0.0, 4.0), (1.0, 156.0), (2.0, 277.0), (3.0, 403.0), (4.0, 599.0),
                (5.0, 690.0), (6.0, 930.0), (7.0, 1023.0), (8.0, 599.0), (9.0, 400.0),
                (10.0, 127.0), (11.0, 4.0), (12.0, 4.0), (13.0, 168.0), (14.0, 337.0),
                (15.0, 609.0), (16.0, 794.0), (17.0, 948.0), (18.0, 739.0), (19.0, 346.0),
                (20.0, 22.0)
            ]
),
(
"095946",
vec![
                (0.0, 1023.0), (1.0, 747.0), (2.0, 600.0), (3.0, 472.0), (4.0, 385.0),
                (5.0, 187.0), (6.0, 56.0), (7.0, 286.0), (8.0, 488.0), (9.0, 730.0),
                (10.0, 910.0), (11.0, 1023.0), (12.0, 795.0), (13.0, 616.0), (14.0, 297.0),
                (15.0, 4.0), (16.0, 20.0), (17.0, 393.0), (18.0, 688.0), (19.0, 850.0),
                (20.0, 1023.0)
            ]
),
(
"100055",
vec![
                (0.0, 518.0), (1.0, 579.0), (2.0, 374.0), (3.0, 699.0), (4.0, 451.0),
                (5.0, 788.0), (6.0, 479.0), (7.0, 558.0), (8.0, 518.0), (9.0, 606.0),
                (10.0, 466.0), (11.0, 674.0), (12.0, 447.0), (13.0, 753.0), (14.0, 472.0),
                (15.0, 801.0), (16.0, 487.0), (17.0, 868.0), (18.0, 538.0), (19.0, 708.0),
                (20.0, 635.0)
            ]
),
];

    let width = 1920;
    let height = 1440;

    for (name, points) in datasets {
        let series_list = vec![SeriesData {
            label: format!("value ({})", name),
            points,
            marker_type: MarkerType::CircleFilled,
            marker_size: 15,
            draw_line: true,
            line_width: 6,
            color: RGBColor(0, 0, 0), // ★ 全て黒色に設定
            use_secondary: false,
        }];

        let config = GraphConfig {
            minor_grid_width: Some(2.0),
            axis_width: None,
            base_font_size: None,
            x_desc: "time [s]".to_string(),
            y_desc: "value".to_string(),
            y2_desc: String::new(),

            x_range: 0.0..20.0,
            y_range: 0.0..1100.0,
            y2_range: 0.0..1.0,

            x_labels: 5,
            y_labels: 6,
            y2_labels: 0,

            x_ticks_mode: TickMode::Explicit(vec![0.0, 5.0, 10.0, 15.0, 20.0]),
            y_ticks_mode: TickMode::Explicit(vec![0.0, 200.0, 400.0, 600.0, 800.0, 1000.0]),
            y2_ticks_mode: TickMode::Auto(0),

            x_tick_length: 30,
            y_tick_length: 30,

            font_name: "meiryo".to_string(),
            x_format_fixed: 0,
            y_format_fixed: 0,
            y2_format_fixed: 0,

            show_legend: false, // ★ 凡例を非表示に設定

            x_transform: AxisTransform::Linear,
            y_transform: AxisTransform::Linear,
            y2_transform: AxisTransform::Linear,

            x_minor_grid_interval: None,        // ★ 縦の目安線（補助グリッド）をなしに設定
            y_minor_grid_interval: Some(100.0), // 横の目安線のみ100刻みで残す
            y2_minor_grid_interval: None,

            use_cross_axes: false,
        };

        let raw_rgb_data = generate_graph_image(width, height, &config, &series_list)?;

        let file_name = format!("graph_{}.png", name);
        let file = File::create(&file_name)?;
        let w = BufWriter::new(file);
        let mut encoder = png::Encoder::new(w, width, height);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header()?;
        writer.write_image_data(&raw_rgb_data)?;

        println!("画像を保存しました: {}", file_name);
    }

    Ok(())

}

## copy

use tab2plot_lib::{generate_graph_image, GraphConfig, MarkerType, SeriesData, TickMode, AxisTransform};
use plotters::prelude::RGBColor;
use std::fs::File;
use std::io::BufWriter;

fn main() -> Result<(), Box<dyn std::error::Error>> {
// データの準備（変更なし）
let series_list = vec![
SeriesData {
label: "1回目".to_string(),
points: vec![(0.0, 3.05), (0.5, 2.25), (1.0, 2.46), (2.0, 2.80), (3.0, 2.98)],
marker_type: MarkerType::Cross,
marker_size: 15,
draw_line: false,
line_width: 0,
color: RGBColor(0, 0, 0),
use_secondary: false,
},
SeriesData {
label: "2回目".to_string(),
points: vec![(0.0, 3.10), (0.5, 2.30), (1.0, 2.44), (2.0, 2.87), (3.0, 3.03)],
marker_type: MarkerType::CircleEmpty,
marker_size: 15,
draw_line: false,
line_width: 0,
color: RGBColor(0, 0, 0),
use_secondary: false,
},
SeriesData {
label: "3回目".to_string(),
points: vec![(0.0, 3.12), (0.5, 2.50), (1.0, 2.30), (2.0, 2.89), (3.0, 3.05)],
marker_type: MarkerType::CircleFilled,
marker_size: 15,
draw_line: false,
line_width: 0,
color: RGBColor(0, 0, 0),
use_secondary: false,
},
SeriesData {
label: "平均".to_string(),
points: vec![(0.0, 3.09), (0.5, 2.35), (1.0, 2.40), (2.0, 2.85), (3.0, 3.02)],
marker_type: MarkerType::CircleFilled,
marker_size: 15,
draw_line: true,
line_width: 6,
color: RGBColor(255, 0, 0),
use_secondary: false,
},
];

    // グラフ設定の作成
    let config = GraphConfig {
        minor_grid_width: Some(2.0),
        axis_width: None,
        base_font_size: None,
        x_desc: "距離 [cm]".to_string(),
        y_desc: "電圧 [V]".to_string(),
        y2_desc: String::new(),

        x_range: 0.0..3.5,
        y_range: 2.0..3.5,
        y2_range: 0.0..1.0,

        x_labels: 8,
        y_labels: 4,
        y2_labels: 0,

        x_ticks_mode: TickMode::Explicit(vec![0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]),
        y_ticks_mode: TickMode::Explicit(vec![2.0, 2.5, 3.0, 3.5]),
        y2_ticks_mode: TickMode::Auto(0),

        x_tick_length: 30,
        y_tick_length: 30,

        font_name: "meiryo".to_string(),
        x_format_fixed: 1,
        y_format_fixed: 1,
        y2_format_fixed: 1,

        show_legend: true,

        x_transform: AxisTransform::Linear,
        y_transform: AxisTransform::Linear,
        y2_transform: AxisTransform::Linear,

        // ★ 変更点: 横線（Y軸補助グリッド）を 0.5 刻みで有効化
        x_minor_grid_interval: None,
        y_minor_grid_interval: Some(0.5),
        y2_minor_grid_interval: None,

        use_cross_axes: false,
    };

    let width = 1920;
    let height = 1440;

    let raw_rgb_data = generate_graph_image(width, height, &config, &series_list)?;

    let file = File::create("graph_422_from_lib.png")?;
    let w = BufWriter::new(file);
    let mut encoder = png::Encoder::new(w, width, height);
    encoder.set_color(png::ColorType::Rgb);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header()?;
    writer.write_image_data(&raw_rgb_data)?;

    println!("画像を保存しました。");
    Ok(())

}

## 2

use tab2plot_lib::{generate_graph_image, GraphConfig, MarkerType, SeriesData, TickMode, AxisTransform};
use plotters::prelude::RGBColor;
use std::fs::File;
use std::io::BufWriter;

fn main() -> Result<(), Box<dyn std::error::Error>> {
// 新しい4つのデータセット定義
let datasets = vec![
(
"101054",
vec![
                (0.0, 3.62), (1.0, 2.65), (2.0, 1.68), (3.0, 2.96), (4.0, 3.60),
                (5.0, 5.24), (6.0, 5.24), (7.0, 4.91), (8.0, 6.83), (9.0, 7.50),
                (10.0, 9.84), (11.0, 9.50), (12.0, 8.47), (13.0, 8.14), (14.0, 8.14),
                (15.0, 5.88), (16.0, 5.56), (17.0, 3.62), (18.0, 2.31), (19.0, 1.67),
                (20.0, 3.60)
            ]
),
(
"101237",
vec![
                (0.0, 2.31), (1.0, 3.93), (2.0, 5.54), (3.0, 1.99), (4.0, 1.99),
                (5.0, 4.59), (6.0, 5.88), (7.0, 6.85), (8.0, 7.50), (9.0, 7.50),
                (10.0, 9.50), (11.0, 9.16), (12.0, 9.50), (13.0, 11.54), (14.0, 12.24),
                (15.0, 11.88), (16.0, 12.56), (17.0, 11.90), (18.0, 13.60), (19.0, 13.24),
                (20.0, 15.96)
            ]
),
(
"101400",
vec![
                (0.0, 16.92), (1.0, 13.94), (2.0, 13.58), (3.0, 12.22), (4.0, 12.22),
                (5.0, 11.56), (6.0, 11.56), (7.0, 10.18), (8.0, 9.50), (9.0, 7.50),
                (10.0, 7.50), (11.0, 6.53), (12.0, 6.53), (13.0, 4.57), (14.0, 3.93),
                (15.0, 3.60), (16.0, 3.30), (17.0, 2.33), (18.0, 1.67), (19.0, 4.27),
                (20.0, 3.28)
            ]
),
(
"101633",
vec![
                (0.0, 4.91), (1.0, 3.60), (2.0, 4.59), (3.0, 5.56), (4.0, 5.56),
                (5.0, 7.50), (6.0, 9.16), (7.0, 8.84), (8.0, 7.50), (9.0, 6.85),
                (10.0, 5.54), (11.0, 5.88), (12.0, 7.50), (13.0, 8.14), (14.0, 9.84),
                (15.0, 9.84), (16.0, 8.14), (17.0, 7.82), (18.0, 6.53), (19.0, 7.17),
                (20.0, 5.54)
            ]
),
];

    let width = 1920;
    let height = 1440;

    for (name, points) in datasets {
        let series_list = vec![SeriesData {
            label: format!("value ({})", name),
            points,
            marker_type: MarkerType::CircleFilled,
            marker_size: 15,
            draw_line: true,
            line_width: 6,
            color: RGBColor(0, 0, 0), // 点と線はすべて黒色
            use_secondary: false,
        }];

        let config = GraphConfig {
            minor_grid_width: Some(2.0),
            axis_width: None,
            base_font_size: None,
            x_desc: "time [s]".to_string(),
            y_desc: "value [cm]".to_string(),
            y2_desc: String::new(),

            x_range: 0.0..20.0,
            y_range: 0.0..18.0, // 今回のデータ範囲（最大約17）に合わせて調整
            y2_range: 0.0..1.0,

            x_labels: 5,
            y_labels: 10,
            y2_labels: 0,

            x_ticks_mode: TickMode::Explicit(vec![0.0, 5.0, 10.0, 15.0, 20.0]),
            y_ticks_mode: TickMode::Explicit(vec![
                0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0
            ]),
            y2_ticks_mode: TickMode::Auto(0),

            x_tick_length: 30,
            y_tick_length: 30,

            font_name: "meiryo".to_string(),
            x_format_fixed: 0,
            y_format_fixed: 0, // 目盛りラベルは整数表示
            y2_format_fixed: 0,

            show_legend: false, // 凡例なし

            x_transform: AxisTransform::Linear,
            y_transform: AxisTransform::Linear,
            y2_transform: AxisTransform::Linear,

            x_minor_grid_interval: None,       // 縦の目安線なし
            y_minor_grid_interval: Some(1.0),  // 横の目安線（1.0刻み）
            y2_minor_grid_interval: None,

            use_cross_axes: false,
        };

        let raw_rgb_data = generate_graph_image(width, height, &config, &series_list)?;

        let file_name = format!("graph_{}.png", name);
        let file = File::create(&file_name)?;
        let w = BufWriter::new(file);
        let mut encoder = png::Encoder::new(w, width, height);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header()?;
        writer.write_image_data(&raw_rgb_data)?;

        println!("画像を保存しました: {}", file_name);
    }

    Ok(())

}
