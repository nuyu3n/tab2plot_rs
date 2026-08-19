import { createEffect, createSignal, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

// --- 型定義 ---
type LineStyleType = "Solid" | "Dashed" | "Dotted" | "DashDot" | "None";
type MarkerType = "CircleFilled" | "CircleEmpty" | "Cross" | "None";
type LegendPosition =
  | "UpperRight"
  | "UpperLeft"
  | "LowerRight"
  | "LowerLeft"
  | "MiddleLeft"
  | "MiddleRight";

type AxisTransformType = "Linear" | "Log10" | "BiLinear";

interface SeriesItem {
  id: string;
  label: string;
  points: [number, number][];
  markerType: MarkerType;
  markerSize: number;
  lineStyle: LineStyleType;
  lineWidth: number;
  color: string; // #rrggbb
  useSecondary: boolean;
}

interface AppGraphState {
  // キャンバス・余白
  canvasWidth: number;
  canvasHeight: number;
  baseFontSize: number;
  margin: number;
  xLabelArea: number;
  yLabelArea: number;
  rightMargin: number;

  // 凡例・レイアウト
  showLegend: boolean;
  legendPosition: LegendPosition;
  useCrossAxes: boolean;
  axisWidth: number;
  minorGridWidth: number;

  // X軸
  xDesc: string;
  xRangeStart: number;
  xRangeEnd: number;
  xTickMode: "Auto" | "Interval" | "Explicit";
  xAutoTicks: number;
  xIntervalBase: number;
  xIntervalOffset: number;
  xExplicitTicks: string;
  xTickLength: number;
  xFormatFixed: number;
  xTransform: AxisTransformType;
  xBiPos: number;
  xBiNeg: number;
  xMinorGridInterval: number;

  // Y軸
  yDesc: string;
  yRangeStart: number;
  yRangeEnd: number;
  yTickMode: "Auto" | "Interval" | "Explicit";
  yAutoTicks: number;
  yIntervalBase: number;
  yIntervalOffset: number;
  yExplicitTicks: string;
  yTickLength: number;
  yFormatFixed: number;
  yTransform: AxisTransformType;
  yBiPos: number;
  yBiNeg: number;
  yMinorGridInterval: number;

  // 第2Y軸 (Y2)
  y2Desc: string;
  y2RangeStart: number;
  y2RangeEnd: number;
  y2TickMode: "Auto" | "Interval" | "Explicit";
  y2AutoTicks: number;
  y2IntervalBase: number;
  y2IntervalOffset: number;
  y2ExplicitTicks: string;
  y2FormatFixed: number;
  y2Transform: AxisTransformType;
  y2BiPos: number;
  y2BiNeg: number;
  y2MinorGridInterval: number;
}

const defaultColors = [
  "#0066cc",
  "#cc3300",
  "#00994c",
  "#e69f00",
  "#9400d3",
  "#d94389",
];

const defaultGraphState: AppGraphState = {
  canvasWidth: 1600,
  canvasHeight: 1200,
  baseFontSize: 36,
  margin: 60,
  xLabelArea: 160,
  yLabelArea: 180,
  rightMargin: 140,

  showLegend: true,
  legendPosition: "UpperRight",
  useCrossAxes: false,
  axisWidth: 3,
  minorGridWidth: 1,

  xDesc: "時間 [s]",
  xRangeStart: 0,
  xRangeEnd: 6,
  xTickMode: "Interval",
  xAutoTicks: 6,
  xIntervalBase: 1,
  xIntervalOffset: 0,
  xExplicitTicks: "0, 1, 2, 3, 4, 5, 6",
  xTickLength: 10,
  xFormatFixed: 1,
  xTransform: "Linear",
  xBiPos: 1,
  xBiNeg: 1,
  xMinorGridInterval: 0.5,

  yDesc: "振幅 [V]",
  yRangeStart: -1.2,
  yRangeEnd: 1.2,
  yTickMode: "Interval",
  yAutoTicks: 5,
  yIntervalBase: 0.5,
  yIntervalOffset: 0,
  yExplicitTicks: "-1, -0.5, 0, 0.5, 1",
  yTickLength: 10,
  yFormatFixed: 1,
  yTransform: "Linear",
  yBiPos: 1,
  yBiNeg: 1,
  yMinorGridInterval: 0.25,

  y2Desc: "位相 [deg]",
  y2RangeStart: -180,
  y2RangeEnd: 180,
  y2TickMode: "Auto",
  y2AutoTicks: 5,
  y2IntervalBase: 45,
  y2IntervalOffset: 0,
  y2ExplicitTicks: "-180, -90, 0, 90, 180",
  y2FormatFixed: 0,
  y2Transform: "Linear",
  y2BiPos: 1,
  y2BiNeg: 1,
  y2MinorGridInterval: 0,
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function parseNumberList(val: string): number[] {
  return val
    .split(/[\s,]+/)
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
}

export default function App() {
  const [graph, setGraph] = createSignal<AppGraphState>({
    ...defaultGraphState,
  });
  const [seriesList, setSeriesList] = createSignal<SeriesItem[]>([
    {
      id: "1",
      label: "CH1 (sin)",
      points: [
        [0.0, 0.0],
        [0.5, 0.48],
        [1.0, 0.84],
        [1.5, 1.0],
        [2.0, 0.91],
        [2.5, 0.6],
        [3.0, 0.14],
        [3.5, -0.35],
        [4.0, -0.76],
        [4.5, -0.98],
        [5.0, -0.96],
        [5.5, -0.71],
        [6.0, -0.28],
      ],
      markerType: "CircleFilled",
      markerSize: 4,
      lineStyle: "Solid",
      lineWidth: 2,
      color: "#0066cc",
      useSecondary: false,
    },
    {
      id: "2",
      label: "CH2 (cos)",
      points: [
        [0.0, 1.0],
        [0.5, 0.88],
        [1.0, 0.54],
        [1.5, 0.07],
        [2.0, -0.42],
        [2.5, -0.8],
        [3.0, -0.99],
        [3.5, -0.94],
        [4.0, -0.65],
        [4.5, -0.21],
        [5.0, 0.28],
        [5.5, 0.71],
        [6.0, 0.96],
      ],
      markerType: "None",
      markerSize: 0,
      lineStyle: "Dashed",
      lineWidth: 2,
      color: "#cc3300",
      useSecondary: false,
    },
  ]);

  const [rawText, setRawText] = createSignal("");
  const [activeTab, setActiveTab] = createSignal<
    "data" | "axes" | "layout" | "batch"
  >("data");
  const [previewSrc, setPreviewSrc] = createSignal("");
  const [statusMessage, setStatusMessage] = createSignal("準備完了");
  const [isRendering, setIsRendering] = createSignal(false);
  const [batchJsonText, setBatchJsonText] = createSignal("");

  // Backend 用 payload 生成
  const buildPayloadConfig = () => {
    const g = graph();
    const buildTicks = (
      mode: "Auto" | "Interval" | "Explicit",
      autoVal: number,
      base: number,
      offset: number,
      explicitStr: string,
    ) => {
      if (mode === "Interval") return { Interval: { base, offset } };
      if (mode === "Explicit")
        return { Explicit: parseNumberList(explicitStr) };
      return { Auto: autoVal };
    };

    const buildTransform = (
      mode: AxisTransformType,
      pos: number,
      neg: number,
    ) => {
      if (mode === "BiLinear")
        return { BiLinear: { pos_int: pos, neg_int: neg } };
      return mode;
    };

    return {
      base_font_size: g.baseFontSize,
      margin: g.margin,
      x_label_area: g.xLabelArea,
      y_label_area: g.yLabelArea,
      right_margin: g.rightMargin,
      x_desc: g.xDesc,
      y_desc: g.yDesc,
      y2_desc: g.y2Desc,
      x_range: { start: g.xRangeStart, end: g.xRangeEnd },
      y_range: { start: g.yRangeStart, end: g.yRangeEnd },
      y2_range: { start: g.y2RangeStart, end: g.y2RangeEnd },
      x_labels: g.xAutoTicks,
      y_labels: g.yAutoTicks,
      y2_labels: g.y2AutoTicks,
      x_ticks_mode: buildTicks(
        g.xTickMode,
        g.xAutoTicks,
        g.xIntervalBase,
        g.xIntervalOffset,
        g.xExplicitTicks,
      ),
      y_ticks_mode: buildTicks(
        g.yTickMode,
        g.yAutoTicks,
        g.yIntervalBase,
        g.yIntervalOffset,
        g.yExplicitTicks,
      ),
      y2_ticks_mode: buildTicks(
        g.y2TickMode,
        g.y2AutoTicks,
        g.y2IntervalBase,
        g.y2IntervalOffset,
        g.y2ExplicitTicks,
      ),
      x_tick_length: g.xTickLength,
      y_tick_length: g.yTickLength,
      font_name: "",
      x_format_fixed: g.xFormatFixed,
      y_format_fixed: g.yFormatFixed,
      y2_format_fixed: g.y2FormatFixed,
      show_legend: g.showLegend,
      legend_position: g.legendPosition,
      x_transform: buildTransform(g.xTransform, g.xBiPos, g.xBiNeg),
      y_transform: buildTransform(g.yTransform, g.yBiPos, g.yBiNeg),
      y2_transform: buildTransform(g.y2Transform, g.y2BiPos, g.y2BiNeg),
      x_minor_grid_interval:
        g.xMinorGridInterval > 0 ? g.xMinorGridInterval : null,
      y_minor_grid_interval:
        g.yMinorGridInterval > 0 ? g.yMinorGridInterval : null,
      y2_minor_grid_interval:
        g.y2MinorGridInterval > 0 ? g.y2MinorGridInterval : null,
      use_cross_axes: g.useCrossAxes,
      axis_width: g.axisWidth,
      minor_grid_width: g.minorGridWidth,
      series_styles: seriesList().map((s) => ({
        label: s.label,
        color: hexToRgb(s.color),
        marker_type: s.markerType,
        marker_size: s.markerSize,
        line_style: s.lineStyle,
        line_width: s.lineWidth,
        use_secondary: s.useSecondary,
      })),
    };
  };

  const buildPayloadSeries = () => {
    return seriesList().map((s) => ({
      label: s.label,
      points: s.points,
      marker_type: s.markerType,
      marker_size: s.markerSize,
      line_style: s.lineStyle,
      line_width: s.lineWidth,
      color: hexToRgb(s.color),
      use_secondary: s.useSecondary,
    }));
  };

  // プレビュー描画処理
  async function triggerPreview() {
    setIsRendering(true);
    try {
      const g = graph();
      const base64 = await invoke<string>("render_graph_base64", {
        config: buildPayloadConfig(),
        seriesList: buildPayloadSeries(),
        width: g.canvasWidth,
        height: g.canvasHeight,
      });
      setPreviewSrc(base64);
      setStatusMessage("プレビューを更新しました");
    } catch (err) {
      setStatusMessage(`描画エラー: ${err}`);
    } finally {
      setIsRendering(false);
    }
  }

  // 自動再描画 (debounce)
  let timer: number | undefined;
  createEffect(() => {
    graph();
    seriesList();
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      triggerPreview();
    }, 250);
  });

  // TSV/CSV テキストのパース
  async function handleParseRawText() {
    if (!rawText().trim()) return;
    try {
      const parsed = await invoke<any[]>("parse_table_data", {
        tableText: rawText(),
        delimiter: null,
        config: buildPayloadConfig(),
      });

      const nextList: SeriesItem[] = parsed.map((p, idx) => ({
        id: String(Date.now() + idx),
        label: p.label || `Series ${idx + 1}`,
        points: p.points,
        markerType: p.marker_type,
        markerSize: p.marker_size,
        lineStyle: p.line_style,
        lineWidth: p.line_width,
        color: defaultColors[idx % defaultColors.length],
        useSecondary: p.use_secondary,
      }));

      setSeriesList(nextList);
      autoScaleRange(nextList);
      setStatusMessage(`${nextList.length} 件の系列をインポートしました`);
    } catch (err) {
      setStatusMessage(`パースエラー: ${err}`);
    }
  }

  // ファイルから直接インポート
  async function handleImportFile() {
    const selected = await open({
      filters: [{ name: "Data File", extensions: ["tsv", "csv", "txt"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    try {
      const preview = await invoke<{ sample_rows: string[][] }>(
        "load_csv_preview",
        {
          filePath: selected,
        },
      );
      const lines = preview.sample_rows.map((row) => row.join("\t")).join("\n");
      setRawText(lines);
      setStatusMessage(`ファイルを読み込みました: ${selected}`);
    } catch (err) {
      setStatusMessage(`ファイル読込エラー: ${err}`);
    }
  }

  // データ範囲の自動調整
  function autoScaleRange(targetSeries = seriesList()) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const s of targetSeries) {
      for (const [x, y] of s.points) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (minX !== Infinity && maxX !== -Infinity) {
      const yPad = (maxY - minY) * 0.1 || 1.0;
      setGraph((g) => ({
        ...g,
        xRangeStart: minX,
        xRangeEnd: maxX,
        yRangeStart: parseFloat((minY - yPad).toFixed(2)),
        yRangeEnd: parseFloat((maxY + yPad).toFixed(2)),
      }));
    }
  }

  // 単一 PNG 保存
  async function handleSaveSinglePng() {
    const selected = await save({
      filters: [{ name: "PNG Image", extensions: ["png"] }],
      defaultPath: "graph.png",
    });
    if (!selected) return;

    try {
      const g = graph();
      await invoke("save_graph_png", {
        config: buildPayloadConfig(),
        seriesList: buildPayloadSeries(),
        width: g.canvasWidth,
        height: g.canvasHeight,
        filePath: selected,
      });
      setStatusMessage(`PNG を保存しました: ${selected}`);
    } catch (err) {
      setStatusMessage(`保存エラー: ${err}`);
    }
  }

  // バッチ実行
  async function handleRunBatch() {
    if (!batchJsonText().trim()) return;
    try {
      await invoke("run_batch_json", { batchJson: batchJsonText() });
      setStatusMessage("バッチ処理が完了しました");
    } catch (err) {
      setStatusMessage(`バッチ実行エラー: ${err}`);
    }
  }

  return (
    <div class="app-layout">
      {/* --- ヘッダー --- */}
      <header class="app-header">
        <div class="brand">
          <h1>tab2plot</h1>
          <span class="version-tag">Engine v0.1</span>
        </div>

        <div class="header-status">
          <span
            class="status-indicator"
            classList={{ active: isRendering() }}
          />
          <span class="status-text">{statusMessage()}</span>
        </div>

        <div class="header-actions">
          <button
            class="btn btn-secondary"
            onClick={triggerPreview}
            disabled={isRendering()}
          >
            {isRendering() ? "描画中..." : "再描画"}
          </button>
          <button class="btn btn-primary" onClick={handleSaveSinglePng}>
            PNG 保存
          </button>
        </div>
      </header>

      {/* --- メインコンテンツ --- */}
      <main class="app-main">
        {/* 左カラム: 設定パネル */}
        <section class="control-panel">
          <div class="tab-bar">
            <button
              class="tab-btn"
              classList={{ active: activeTab() === "data" }}
              onClick={() => setActiveTab("data")}
            >
              データ & 系列
            </button>
            <button
              class="tab-btn"
              classList={{ active: activeTab() === "axes" }}
              onClick={() => setActiveTab("axes")}
            >
              軸 & スケール
            </button>
            <button
              class="tab-btn"
              classList={{ active: activeTab() === "layout" }}
              onClick={() => setActiveTab("layout")}
            >
              余白 & スタイル
            </button>
            <button
              class="tab-btn"
              classList={{ active: activeTab() === "batch" }}
              onClick={() => setActiveTab("batch")}
            >
              バッチ設定
            </button>
          </div>

          <div class="tab-content">
            {/* 1. データ & 系列タブ */}
            <Show when={activeTab() === "data"}>
              <div class="section-card">
                <h3>TSV / CSV データ入力</h3>
                <textarea
                  class="data-textarea"
                  placeholder="time&#9;ch1&#9;ch2&#10;0.0&#9;0.0&#9;1.0&#10;1.0&#9;0.84&#9;0.54"
                  value={rawText()}
                  onInput={(e) => setRawText(e.currentTarget.value)}
                />
                <div class="btn-group">
                  <button class="btn btn-secondary" onClick={handleImportFile}>
                    ファイルから読込
                  </button>
                  <button class="btn btn-accent" onClick={handleParseRawText}>
                    データをパースして反映
                  </button>
                  <button
                    class="btn btn-ghost"
                    onClick={() => autoScaleRange()}
                  >
                    自動範囲調整
                  </button>
                </div>
              </div>

              <div class="section-card">
                <div class="section-header">
                  <h3>系列スタイル設定 ({seriesList().length})</h3>
                  <button
                    class="btn btn-small btn-secondary"
                    onClick={() =>
                      setSeriesList((list) => [
                        ...list,
                        {
                          id: String(Date.now()),
                          label: `Series ${list.length + 1}`,
                          points: [],
                          markerType: "CircleFilled",
                          markerSize: 4,
                          lineStyle: "Solid",
                          lineWidth: 2,
                          color:
                            defaultColors[list.length % defaultColors.length],
                          useSecondary: false,
                        },
                      ])
                    }
                  >
                    + 系列追加
                  </button>
                </div>

                <For each={seriesList()}>
                  {(s, idx) => (
                    <div class="series-row">
                      <div class="series-header">
                        <input
                          type="color"
                          class="color-picker"
                          value={s.color}
                          onInput={(e) =>
                            setSeriesList((list) =>
                              list.map((item, i) =>
                                i === idx()
                                  ? { ...item, color: e.currentTarget.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <input
                          type="text"
                          class="input-text series-name-input"
                          value={s.label}
                          onInput={(e) =>
                            setSeriesList((list) =>
                              list.map((item, i) =>
                                i === idx()
                                  ? { ...item, label: e.currentTarget.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <label class="checkbox-label">
                          <input
                            type="checkbox"
                            checked={s.useSecondary}
                            onChange={(e) =>
                              setSeriesList((list) =>
                                list.map((item, i) =>
                                  i === idx()
                                    ? {
                                        ...item,
                                        useSecondary: e.currentTarget.checked,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                          右軸(Y2)
                        </label>
                        <button
                          class="btn-icon danger"
                          onClick={() =>
                            setSeriesList((list) =>
                              list.filter((_, i) => i !== idx()),
                            )
                          }
                        >
                          ✕
                        </button>
                      </div>

                      <div class="grid-4">
                        <label class="form-group">
                          <span>線種</span>
                          <select
                            class="input-select"
                            value={s.lineStyle}
                            onChange={(e) =>
                              setSeriesList((list) =>
                                list.map((item, i) =>
                                  i === idx()
                                    ? {
                                        ...item,
                                        lineStyle: e.currentTarget
                                          .value as LineStyleType,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="Solid">実線 (Solid)</option>
                            <option value="Dashed">破線 (Dashed)</option>
                            <option value="Dotted">点線 (Dotted)</option>
                            <option value="DashDot">一点鎖線 (DashDot)</option>
                            <option value="None">線なし (None)</option>
                          </select>
                        </label>

                        <label class="form-group">
                          <span>線幅 (px)</span>
                          <input
                            type="number"
                            class="input-number"
                            min="1"
                            max="10"
                            value={s.lineWidth}
                            onInput={(e) =>
                              setSeriesList((list) =>
                                list.map((item, i) =>
                                  i === idx()
                                    ? {
                                        ...item,
                                        lineWidth:
                                          parseInt(e.currentTarget.value) || 1,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>

                        <label class="form-group">
                          <span>点 (Marker)</span>
                          <select
                            class="input-select"
                            value={s.markerType}
                            onChange={(e) =>
                              setSeriesList((list) =>
                                list.map((item, i) =>
                                  i === idx()
                                    ? {
                                        ...item,
                                        markerType: e.currentTarget
                                          .value as MarkerType,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="CircleFilled">
                              塗り円 (CircleFilled)
                            </option>
                            <option value="CircleEmpty">
                              白抜き円 (CircleEmpty)
                            </option>
                            <option value="Cross">十字 (Cross)</option>
                            <option value="None">なし (None)</option>
                          </select>
                        </label>

                        <label class="form-group">
                          <span>点サイズ</span>
                          <input
                            type="number"
                            class="input-number"
                            min="0"
                            max="20"
                            value={s.markerSize}
                            onInput={(e) =>
                              setSeriesList((list) =>
                                list.map((item, i) =>
                                  i === idx()
                                    ? {
                                        ...item,
                                        markerSize:
                                          parseInt(e.currentTarget.value) || 0,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* 2. 軸 & スケールタブ */}
            <Show when={activeTab() === "axes"}>
              <div class="section-card">
                <h3>X 軸 (横軸)</h3>
                <div class="grid-3">
                  <label class="form-group">
                    <span>タイトル</span>
                    <input
                      type="text"
                      class="input-text"
                      value={graph().xDesc}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xDesc: e.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>開始</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().xRangeStart}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xRangeStart: parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>終了</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().xRangeEnd}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xRangeEnd: parseFloat(e.currentTarget.value) || 1,
                        }))
                      }
                    />
                  </label>
                </div>

                <div class="grid-3">
                  <label class="form-group">
                    <span>変換</span>
                    <select
                      class="input-select"
                      value={graph().xTransform}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xTransform: e.currentTarget
                            .value as AxisTransformType,
                        }))
                      }
                    >
                      <option value="Linear">Linear (線形)</option>
                      <option value="Log10">Log10 (対数)</option>
                      <option value="BiLinear">BiLinear (原点両方向)</option>
                    </select>
                  </label>

                  <label class="form-group">
                    <span>目盛りモード</span>
                    <select
                      class="input-select"
                      value={graph().xTickMode}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xTickMode: e.currentTarget.value as any,
                        }))
                      }
                    >
                      <option value="Interval">Interval (ステップ)</option>
                      <option value="Auto">Auto (本数指定)</option>
                      <option value="Explicit">Explicit (明示リスト)</option>
                    </select>
                  </label>

                  <label class="form-group">
                    <span>補助グリッド間隔</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().xMinorGridInterval}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xMinorGridInterval:
                            parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                </div>

                <Show when={graph().xTickMode === "Interval"}>
                  <div class="grid-2 sub-panel">
                    <label class="form-group">
                      <span>間隔 (Base)</span>
                      <input
                        type="number"
                        step="any"
                        class="input-number"
                        value={graph().xIntervalBase}
                        onInput={(e) =>
                          setGraph((g) => ({
                            ...g,
                            xIntervalBase:
                              parseFloat(e.currentTarget.value) || 1,
                          }))
                        }
                      />
                    </label>
                    <label class="form-group">
                      <span>オフセット (Offset)</span>
                      <input
                        type="number"
                        step="any"
                        class="input-number"
                        value={graph().xIntervalOffset}
                        onInput={(e) =>
                          setGraph((g) => ({
                            ...g,
                            xIntervalOffset:
                              parseFloat(e.currentTarget.value) || 0,
                          }))
                        }
                      />
                    </label>
                  </div>
                </Show>

                <Show when={graph().xTickMode === "Explicit"}>
                  <div class="sub-panel">
                    <label class="form-group">
                      <span>目盛り値リスト (カンマ区切り)</span>
                      <input
                        type="text"
                        class="input-text"
                        value={graph().xExplicitTicks}
                        onInput={(e) =>
                          setGraph((g) => ({
                            ...g,
                            xExplicitTicks: e.currentTarget.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </Show>
              </div>

              <div class="section-card">
                <h3>Y 軸 (主軸)</h3>
                <div class="grid-3">
                  <label class="form-group">
                    <span>タイトル</span>
                    <input
                      type="text"
                      class="input-text"
                      value={graph().yDesc}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yDesc: e.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>開始</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().yRangeStart}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yRangeStart: parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>終了</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().yRangeEnd}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yRangeEnd: parseFloat(e.currentTarget.value) || 1,
                        }))
                      }
                    />
                  </label>
                </div>

                <div class="grid-3">
                  <label class="form-group">
                    <span>変換</span>
                    <select
                      class="input-select"
                      value={graph().yTransform}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yTransform: e.currentTarget
                            .value as AxisTransformType,
                        }))
                      }
                    >
                      <option value="Linear">Linear (線形)</option>
                      <option value="Log10">Log10 (対数)</option>
                      <option value="BiLinear">BiLinear</option>
                    </select>
                  </label>

                  <label class="form-group">
                    <span>目盛りモード</span>
                    <select
                      class="input-select"
                      value={graph().yTickMode}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yTickMode: e.currentTarget.value as any,
                        }))
                      }
                    >
                      <option value="Interval">Interval (ステップ)</option>
                      <option value="Auto">Auto (本数指定)</option>
                      <option value="Explicit">Explicit (明示リスト)</option>
                    </select>
                  </label>

                  <label class="form-group">
                    <span>補助グリッド間隔</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().yMinorGridInterval}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yMinorGridInterval:
                            parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                </div>

                <Show when={graph().yTickMode === "Interval"}>
                  <div class="grid-2 sub-panel">
                    <label class="form-group">
                      <span>間隔 (Base)</span>
                      <input
                        type="number"
                        step="any"
                        class="input-number"
                        value={graph().yIntervalBase}
                        onInput={(e) =>
                          setGraph((g) => ({
                            ...g,
                            yIntervalBase:
                              parseFloat(e.currentTarget.value) || 1,
                          }))
                        }
                      />
                    </label>
                    <label class="form-group">
                      <span>オフセット (Offset)</span>
                      <input
                        type="number"
                        step="any"
                        class="input-number"
                        value={graph().yIntervalOffset}
                        onInput={(e) =>
                          setGraph((g) => ({
                            ...g,
                            yIntervalOffset:
                              parseFloat(e.currentTarget.value) || 0,
                          }))
                        }
                      />
                    </label>
                  </div>
                </Show>
              </div>

              <div class="section-card">
                <h3>Y2 軸 (第2Y軸・右軸)</h3>
                <div class="grid-3">
                  <label class="form-group">
                    <span>タイトル</span>
                    <input
                      type="text"
                      class="input-text"
                      value={graph().y2Desc}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          y2Desc: e.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>開始</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().y2RangeStart}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          y2RangeStart: parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>終了</span>
                    <input
                      type="number"
                      step="any"
                      class="input-number"
                      value={graph().y2RangeEnd}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          y2RangeEnd: parseFloat(e.currentTarget.value) || 1,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </Show>

            {/* 3. 余白 & レイアウトタブ */}
            <Show when={activeTab() === "layout"}>
              <div class="section-card">
                <h3>キャンバス解像度 & 基本フォント</h3>
                <div class="grid-3">
                  <label class="form-group">
                    <span>画像幅 (px)</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().canvasWidth}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          canvasWidth: parseInt(e.currentTarget.value) || 1600,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>画像高さ (px)</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().canvasHeight}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          canvasHeight: parseInt(e.currentTarget.value) || 1200,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>フォントサイズ</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().baseFontSize}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          baseFontSize: parseInt(e.currentTarget.value) || 36,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div class="section-card">
                <h3>余白・間隔の調整</h3>
                <div class="grid-4">
                  <label class="form-group">
                    <span>外周余白 (margin)</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().margin}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          margin: parseInt(e.currentTarget.value) || 60,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>X軸エリア幅</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().xLabelArea}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xLabelArea: parseInt(e.currentTarget.value) || 160,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>Y軸エリア幅</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().yLabelArea}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yLabelArea: parseInt(e.currentTarget.value) || 180,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>右余白 (right_margin)</span>
                    <input
                      type="number"
                      class="input-number"
                      value={graph().rightMargin}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          rightMargin: parseInt(e.currentTarget.value) || 140,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div class="section-card">
                <h3>凡例 & スタイル設定</h3>
                <div class="grid-3">
                  <label
                    class="checkbox-label"
                    style={{ "margin-top": "24px" }}
                  >
                    <input
                      type="checkbox"
                      checked={graph().showLegend}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          showLegend: e.currentTarget.checked,
                        }))
                      }
                    />
                    凡例を表示する
                  </label>

                  <label class="form-group">
                    <span>凡例位置</span>
                    <select
                      class="input-select"
                      value={graph().legendPosition}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          legendPosition: e.currentTarget
                            .value as LegendPosition,
                        }))
                      }
                    >
                      <option value="UpperRight">右上 (UpperRight)</option>
                      <option value="UpperLeft">左上 (UpperLeft)</option>
                      <option value="LowerRight">右下 (LowerRight)</option>
                      <option value="LowerLeft">左下 (LowerLeft)</option>
                      <option value="MiddleLeft">中左 (MiddleLeft)</option>
                      <option value="MiddleRight">中右 (MiddleRight)</option>
                    </select>
                  </label>

                  <label
                    class="checkbox-label"
                    style={{ "margin-top": "24px" }}
                  >
                    <input
                      type="checkbox"
                      checked={graph().useCrossAxes}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          useCrossAxes: e.currentTarget.checked,
                        }))
                      }
                    />
                    十字軸モード
                  </label>
                </div>

                <div class="grid-2" style={{ "margin-top": "12px" }}>
                  <label class="form-group">
                    <span>枠線の太さ (px)</span>
                    <input
                      type="number"
                      step="0.5"
                      class="input-number"
                      value={graph().axisWidth}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          axisWidth: parseFloat(e.currentTarget.value) || 3,
                        }))
                      }
                    />
                  </label>
                  <label class="form-group">
                    <span>補助線の太さ (px)</span>
                    <input
                      type="number"
                      step="0.5"
                      class="input-number"
                      value={graph().minorGridWidth}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          minorGridWidth:
                            parseFloat(e.currentTarget.value) || 1,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </Show>

            {/* 4. バッチ設定タブ */}
            <Show when={activeTab() === "batch"}>
              <div class="section-card">
                <h3>バッチ設定 JSON 実行</h3>
                <p class="desc-text">
                  複数の CSV/TSV を一度に処理する <code>BatchConfig</code>{" "}
                  を直接入力して実行できます。
                </p>
                <textarea
                  class="data-textarea batch-area"
                  placeholder='{\n  "default_width": 1600,\n  "tasks": [\n    { "input": "data.tsv", "output": "out.png" }\n  ]\n}'
                  value={batchJsonText()}
                  onInput={(e) => setBatchJsonText(e.currentTarget.value)}
                />
                <button class="btn btn-primary" onClick={handleRunBatch}>
                  バッチ一括実行
                </button>
              </div>
            </Show>
          </div>
        </section>

        {/* 右カラム: プレビュー画面 */}
        <section class="preview-panel">
          <div class="preview-box">
            <Show
              when={previewSrc()}
              fallback={
                <div class="preview-placeholder">
                  描画結果がここに表示されます
                </div>
              }
            >
              <img src={previewSrc()} alt="Graph Preview" class="preview-img" />
            </Show>
          </div>

          <div class="preview-footer">
            <div class="meta-badge">
              {graph().canvasWidth} × {graph().canvasHeight} px
            </div>
            <div class="meta-badge">
              系列: {seriesList().length} 個 (
              {seriesList().reduce((acc, s) => acc + s.points.length, 0)} 点)
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
