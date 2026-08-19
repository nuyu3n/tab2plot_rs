# tab2plot_rs

`tab2plot_rs` は、実験レポートや学術論文水準の高品位なグラフ（PNG画像）を素早く作成・出力できる、Tauri v2 + Solid.js 製のデスクトップアプリおよび Rust グラフ描画エンジンです。

表データ（TSV / CSV）のインポートからリアルタイムプレビュー、GUI上での細かなスタイリング、単一PNG保存、さらにはバッチ設定JSONによる複数グラフの一括自動生成までをシームレスに行えます。

---

## 主な機能

### 1. 論文・レポートに最適化されたタイポグラフィ

- **フォントの自動使い分け**: 軸タイトル・凡例には品位ある明朝体（`Noto Serif JP`）、目盛り数値には縮小時も視認性の高いゴシック体（`Noto Sans JP`）を適用。
- **環境非依存**: フォントデータをバイナリに内蔵しているため、OSのフォント環境に左右されず一貫した出力を保証。

### 2. 高度な軸・スケール制御

- **3つの軸変換**:
  - `Linear`: 標準的な線形スケール
  - `Log10`: 周波数特性・ボード線図向けの常用対数スケール
  - `BiLinear`: 原点 $(0, 0)$ を境に正負で拡大率を変える特殊スケール（半導体のIVカーブ等）
- **第2Y軸（右軸）**: 異なる単位・スケールの系列を同一グラフ上に同時プロット可能。
- **レイアウトモード**: 外枠に内向き目盛りを配する「標準外枠モード」と、原点で軸が交差する「十字軸モード」を切り替え可能。

### 3. 系列スタイルと目盛り・補助線

- **線種**: 実線 (`Solid`)、破線 (`Dashed`)、点線 (`Dotted`)、一点鎖線 (`DashDot`)、なし (`None`)。
- **マーカー**: 塗りつぶし円 (`CircleFilled`)、白抜き円 (`CircleEmpty`)、十字 (`Cross`)、なし (`None`)。
- **目盛り制御**: 固定ステップ刻み (`Interval`)、特定数値の指定 (`Explicit`)、本数目安による自動 (`Auto`)。
- **補助グリッド & 余白調整**: 任意の細かさで薄い格子線を引けるほか、余白・軸ラベルエリア幅をpx単位で微調整して文字被りを防止。

### 4. リアルタイムプレビュー & 一括バッチ生成

- **即時プレビュー**: GUIでパラメータやデータを変更すると、自動でRustバックエンドが高解像度レンダリングを実行。
- **バッチ処理**: 共通スタイルと個別差分設定をまとめた `batch.json` から、複数グラフを一撃で一括出力。

---

## ファイル構成

```

tab2plot_rs/
├── src/ # フロントエンド (Solid.js + TypeScript + CSS)
│ ├── App.tsx # メインUI・状態管理・Tauri Invoke連携
│ ├── App.css # スタイリング
│ └── index.tsx # エントリーポイント
├── src-tauri/ # Tauri バックエンド
│ ├── src/
│ │ └── lib.rs # Tauri コマンドハンドラ（IPC）
│ ├── tab2plot/ # コア描画エンジン (Rust クレート)
│ │ ├── assets/ # 埋め込みフォント (Noto Serif / Sans)
│ │ ├── src/
│ │ │ ├── lib.rs # 描画本体・マクロ・座標変換
│ │ │ ├── wrap.rs # CSV/TSVパース・バッチ実行・PNG変換
│ │ │ └── main.rs # CLIエントリーポイント
│ │ └── samples/ # テストデータ & 設定サンプル
│ └── Cargo.toml
└── package.json

```

---

## 開発・実行方法

### 必要環境

- Node.js (v18+) & pnpm
- Rust (最新の stable ツールチェーン)

### 開発モードの起動

```bash
# 依存関係のインストール
pnpm install

# Tauri デスクトップアプリの起動（Hot Reload 対応）
pnpm tauri dev

```

### ビルド

```bash
# フロントエンド単体ビルド
pnpm build

# アプリケーションパッケージング
pnpm tauri build

```

---

## CLI ツールとしての単体利用

`tab2plot` サブディレクトリ内の CLI を直接実行することも可能です。

```bash
# tab2plot ディレクトリへ移動
cd src-tauri/tab2plot

# 1. バッチ設定 JSON による一括生成
cargo run -- -b samples/batch.json

# 2. 単一 TSV からのグラフ生成
cargo run -- -i samples/wave.tsv -c samples/config.json -o output.png --width 1600 --height 1200

# 3. 複数 TSV を指定フォルダへ一括書き出し
cargo run -- -i samples/*.tsv -o dist/ -c samples/config.json

```

---

## 推奨開発環境

- **エディタ**: Visual Studio Code
- **推奨拡張機能**:
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
