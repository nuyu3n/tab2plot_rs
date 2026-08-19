# AGENTS.md - tab2plot

## 1. プロジェクト概要

`tab2plot` は、CSV/TSV形式の表データとJSON設定ファイルを入力とし、学術論文・実験レポート水準の高品位なグラフ（PNG画像）を高速に自動生成するRust製グラフ描画エンジン・CLIツールです。
単一ファイルのプロットはもちろん、1つのバッチ設定JSONから複数グラフ（波形、周波数特性、IVカーブ等）を一括生成するバッチ処理機能、デスクトップアプリ（Tauri）やWebバックエンド向けのライブラリAPI（`wrap.rs`）を提供します。

---

## 2. ファイル構成と役割

```

tab2plot/
├── assets/
│ ├── NotoSansJP-Regular.ttf # 目盛り数値用 Sans-Serif フォント
│ └── NotoSerifJP-Regular.ttf # 軸タイトル・凡例用 Serif フォント
├── src/
│ ├── lib.rs # コア描画エンジン・座標変換・レイアウト・描画マクロ
│ ├── wrap.rs # CSV/TSVパース・JSON設定マージ・バッチ実行・PNGエンコーダ
│ └── main.rs # CLIエントリーポイント (clap)
├── samples/ # テストデータ・設定サンプル
└── Cargo.toml

```

---

## 3. 主要機能一覧

### 3.1 データ入力と系列解析

- **CSV / TSV 自動判別**: タブ文字の有無から区切り文字を自動判定（明示指定も可能）。
- **複数系列の一括読み込み**: 1列目をX軸、2列目以降を各系列のY軸データとして解釈。
- **ヘッダー & コメント対応**: 1行目を系列名として取得、`#` から始まる行をコメントとしてスキップ。
- **Auto Range（自動範囲算出）**: 範囲未指定時は、データの最小値・最大値および10%のマージンから描画範囲を自動計算。

### 3.2 軸・スケール変換 (`AxisTransform`)

- **`Linear`**: 通常の等間隔線形スケール。
- **`Log10`**: 周波数特性・ボード線図などに適した常用対数スケール。
- **`BiLinear { pos_int, neg_int }`**: 原点 $(0, 0)$ を境に正負で拡大率を変える特殊スケール（半導体IVカーブ等）。

### 3.3 2つのレイアウト形式

- **外枠モード（標準）**: 四角い外枠に内向き目盛り線を配置する論文標準スタイル。
- **十字軸モード (`use_cross_axes: true`)**: 原点 $(0, 0)$ で縦横軸が交差し、原点付近の数値重なりを自動回避するスタイル。

### 3.4 第2Y軸（右軸）対応

- `use_secondary: true` を指定した系列は右側の第2Y軸にバインドされ、異なる単位・スケールを1枚のグラフに同時描画。

### 3.5 タイポグラフィとフォント使い分け

- **Serif (`Noto Serif JP`)**: 軸タイトル (`x_desc`, `y_desc`, `y2_desc`)、凡例ラベル。
- **Sans-serif (`Noto Sans JP`)**: 目盛り数値（Tick Labels）に適用し、縮小表示時の視認性を確保。
- バイナリ内蔵フォントのため、実行環境のOSフォント依存なし。

### 3.6 線種・マーカー・色指定

- **線種 (`LineStyleType`)**: `Solid`（実線）、`Dashed`（破線）、`Dotted`（点線）、`DashDot`（一点鎖線）、`None`（線なし）。
  - 画面比率に応じた正規化座標系によるダッシュ生成を実装。
- **マーカー (`MarkerType`)**: `CircleFilled`（塗り円）、`CircleEmpty`（白抜き円）、`Cross`（十字）、`None`。
- **色**: RGB配列 `[R, G, B]` (0〜255) で系列ごとに自由指定。

### 3.7 目盛り & 補助線制御

- **目盛り指定 (`TickMode`)**:
  - `Interval { base, offset }`: 固定ステップ（例: 0.5刻み）。
  - `Explicit([v1, v2, ...])`: 明示的な数値列挙（対数軸の $10^n$ 指定等）。
  - `Auto(n)`: 目安本数に基づく自動配置。
- **補助グリッド**: `x_minor_grid_interval`, `y_minor_grid_interval`, `y2_minor_grid_interval` で任意の細かさの薄い格子線を描画。

### 3.8 余白・間隔の微調整

- `margin`: 外周余白 (px)。
- `x_label_area`: 下部（X軸目盛り〜タイトル）エリア幅 (px)。
- `y_label_area`: 左部（Y軸目盛り〜タイトル）エリア幅 (px)。
- `right_margin`: 右側余白 / 第2Y軸エリア幅 (px)。

### 3.9 バッチ生成 & 設定マージ

- 単一の `batch.json` から全タスク共通設定 (`common`) と個別設定 (`tasks`) を合成（ディープマージ）して複数グラフを一括出力。
- すべての設定項目にデフォルト値が定義されているため、変更したい項目だけの部分指定（差分指定）が可能。

---

## 4. 設定ファイル仕様

### 4.1 単一グラフ設定 (`GraphConfig`)

すべての項目が省略可能です（未指定項目は自動でデフォルト値が適用されます）。

```json
{
  "base_font_size": 36,
  "margin": 60,
  "x_label_area": 160,
  "y_label_area": 200,
  "right_margin": 140,
  "x_desc": "時間 [s]",
  "y_desc": "振幅 [V]",
  "y2_desc": "位相 [deg]",
  "x_range": { "start": 0.0, "end": 10.0 },
  "y_range": { "start": -1.5, "end": 1.5 },
  "y2_range": { "start": -180.0, "end": 180.0 },
  "x_labels": 6,
  "y_labels": 5,
  "y2_labels": 5,
  "x_ticks_mode": { "Interval": { "base": 2.0, "offset": 0.0 } },
  "y_ticks_mode": { "Interval": { "base": 0.5, "offset": 0.0 } },
  "y2_ticks_mode": { "Auto": 5 },
  "x_tick_length": 8,
  "y_tick_length": 8,
  "font_name": "",
  "x_format_fixed": 1,
  "y_format_fixed": 2,
  "y2_format_fixed": 0,
  "show_legend": true,
  "legend_position": "UpperRight",
  "x_transform": "Linear",
  "y_transform": "Linear",
  "y2_transform": "Linear",
  "x_minor_grid_interval": 0.5,
  "y_minor_grid_interval": 0.25,
  "y2_minor_grid_interval": 30.0,
  "use_cross_axes": false,
  "axis_width": 3.0,
  "minor_grid_width": 1.0,
  "series_styles": [
    {
      "label": "測定値",
      "color": [0, 102, 204],
      "marker_type": "CircleFilled",
      "marker_size": 4,
      "line_style": "Solid",
      "line_width": 2,
      "use_secondary": false
    },
    {
      "label": "理論値",
      "color": [204, 51, 0],
      "marker_type": "None",
      "marker_size": 0,
      "line_style": "Dashed",
      "line_width": 2,
      "use_secondary": false
    }
  ]
}
```

### 4.2 バッチ一括設定 (`BatchConfig`)

共通設定 (`common`) をベースにしつつ、各タスク内で差分設定をインライン上書き、または外部JSONファイル (`config_path`) をマージして実行します。

```json
{
  "default_width": 1600,
  "default_height": 1200,
  "common": {
    "base_font_size": 36,
    "axis_width": 3.0,
    "minor_grid_width": 1.0,
    "show_legend": true,
    "legend_position": "UpperRight"
  },
  "tasks": [
    {
      "input": "samples/wave.tsv",
      "output": "dist/wave.png",
      "config": {
        "x_desc": "時間 [s]",
        "y_desc": "電圧 [V]",
        "x_minor_grid_interval": 0.5
      }
    },
    {
      "input": "samples/bode.tsv",
      "output": "dist/bode.png",
      "config": {
        "x_desc": "周波数 [Hz]",
        "y_desc": "利得 [dB]",
        "x_transform": "Log10",
        "x_range": { "start": 10.0, "end": 100000.0 },
        "x_ticks_mode": { "Explicit": [10.0, 100.0, 1000.0, 10000.0, 100000.0] }
      }
    },
    {
      "input": "samples/other.tsv",
      "output": "dist/other.png",
      "config_path": "samples/custom_config.json"
    }
  ]
}
```

---

## 5. CLI コマンド仕様

```bash
# 1. バッチ設定JSONによる一括生成
cargo run -- -b samples/batch.json

# 2. 単一ファイルの生成（自動デフォルト設定）
cargo run -- -i data.tsv -o output.png

# 3. 単一ファイル＋設定JSON＋解像度指定
cargo run -- -i data.tsv -c config.json -o graph.png --width 1920 --height 1440

# 4. 複数ファイルを一括生成（指定ディレクトリへ同名PNGを出力）
cargo run -- -i samples/data1.tsv samples/data2.tsv -o dist/ -c samples/common.json

```

### オプション一覧

- `-b, --batch <PATH>`: バッチ設定JSONファイルパス（指定時はバッチモードで実行）
- `-i, --input <PATH...>`: 入力データファイルパス（複数指定可能）
- `-o, --output <PATH>`: 出力先パス（単一処理時はファイルパス、複数処理時は出力ディレクトリ）
- `-c, --config <PATH>`: グラフ設定JSONファイルパス（差分指定・省略可）
- `--width <UINT>`: 出力画像幅（デフォルト: `1920`）
- `--height <UINT>`: 出力画像高さ（デフォルト: `1440`）

---

## 6. ライブラリ API（Tauri / バックエンド連携）

```rust
use tab2plot::wrap::{render_to_png_bytes, render_from_files, execute_batch};

// 1. 文字列データとJSONからメモリ上にPNGバイト列を直接生成
let png_bytes: Vec<u8> = render_to_png_bytes(
    table_text,           // &str (CSV/TSV)
    Some(config_json),    // Option<&str> (NoneでAuto Range・デフォルト設定)
    1920,                 // width
    1440,                 // height
    None,                 // delimiter: Option<u8> (Noneで自動判別)
)?;

// 2. ファイルパスベースの単一生成
render_from_files("input.tsv", "output.png", Some("config.json"), 1920, 1440)?;

// 3. バッチ設定ファイルの一括実行
execute_batch("samples/batch.json")?;

```
