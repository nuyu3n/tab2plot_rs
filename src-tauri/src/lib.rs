use plotters::prelude::*;
use std::ops::Range;
use tab2plot_lib::{
    generate_graph_image, AxisTransform, GraphConfig,
    MarkerType, SeriesData, TickMode
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let trace1 = SeriesData {
        label: "サンプル系列".to_string(),
        points: vec![
            (0.0, 0.0),
            (1.0, 10.0),
            (2.0, 25.0),
            (3.0, 15.0),
            (4.0, 30.0),
        ],
        marker_type: MarkerType::CircleFilled,
        marker_size: 6,
        draw_line: true,
        line_width: 2,
        color: RGBColor(255, 0, 0), // 赤色
        use_secondary: false,      // 主軸を使用
    };

    let series_list = vec![trace1];

    // 2. グラフ全体の設定（インプット）の組み立て
    let config = GraphConfig {
        base_font_size: Some(40),
        x_desc: "時間 [s]".to_string(),
        y_desc: "カウント".to_string(),
        y2_desc: "".to_string(),

        x_range: 0.0..5.0,
        y_range: 0.0..40.0,
        y2_range: 0.0..1.0, // 未使用だがデフォルト値

        x_labels: 5,
        y_labels: 5,
        y2_labels: 0,

        x_ticks_mode: TickMode::Auto(5),
        // Y軸は2.0刻み、オフセット0.0のインターバル指定例
        y_ticks_mode: TickMode::Interval { base: 2.0, offset: 0.0 },
        y2_ticks_mode: TickMode::Auto(0),

        x_tick_length: 15,
        y_tick_length: 15,
        font_name: "sans-serif".to_string(),
        x_format_fixed: 1,
        y_format_fixed: 1,
        y2_format_fixed: 0,
        show_legend: true,

        x_transform: AxisTransform::Linear,
        y_transform: AxisTransform::Linear,
        y2_transform: AxisTransform::Linear,

        x_minor_grid_interval: Some(0.5), // 0.5刻みで補助線を引く
        y_minor_grid_interval: None,
        y2_minor_grid_interval: None,

        use_cross_axes: false, // 通常の外枠モード
        axis_width: Some(4.0),
        minor_grid_width: Some(1.0),
    };

    // 3. 描画関数の実行（アウトプットの取得）
    let width = 1920;
    let height = 1440;

    // raw_rgb に width * height * 3 バイトの RAW RGBデータが返る
    let raw_rgb = generate_graph_image(width, height, &config, &series_list)?;

    println!("描画成功: {} バイトのRAWデータを取得しました。", raw_rgb.len());
    Ok(())
}
