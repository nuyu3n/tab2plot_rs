import { createEffect, createSignal, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

type Point = [number, number];
type RGB = [number, number, number];
type MarkerType = "CircleFilled" | "CircleEmpty" | "Cross" | "None";
type TickMode =
  | { Auto: number }
  | { Explicit: number[] }
  | { Interval: { base: number; offset: number } };
type AxisTransform =
  | "Linear"
  | "Log10"
  | { BiLinear: { pos_int: number; neg_int: number } };

interface SeriesForm {
  label: string;
  points: Point[];
  markerType: MarkerType;
  markerSize: number;
  drawLine: boolean;
  lineWidth: number;
  color: string;
  useSecondary: boolean;
}

interface GraphForm {
  canvasWidth: number;
  canvasHeight: number;
  baseFontSize: number;
  fontName: string;
  xDesc: string;
  yDesc: string;
  y2Desc: string;
  xRangeStart: number;
  xRangeEnd: number;
  yRangeStart: number;
  yRangeEnd: number;
  y2RangeStart: number;
  y2RangeEnd: number;
  xLabels: number;
  yLabels: number;
  y2Labels: number;
  xTickMode: "Auto" | "Explicit" | "Interval";
  yTickMode: "Auto" | "Explicit" | "Interval";
  y2TickMode: "Auto" | "Explicit" | "Interval";
  xAutoTicks: number;
  yAutoTicks: number;
  y2AutoTicks: number;
  xExplicitTicks: string;
  yExplicitTicks: string;
  y2ExplicitTicks: string;
  xIntervalBase: number;
  xIntervalOffset: number;
  yIntervalBase: number;
  yIntervalOffset: number;
  y2IntervalBase: number;
  y2IntervalOffset: number;
  xTickLength: number;
  yTickLength: number;
  xFormatFixed: number;
  yFormatFixed: number;
  y2FormatFixed: number;
  showLegend: boolean;
  xTransform: "Linear" | "Log10" | "BiLinear";
  yTransform: "Linear" | "Log10" | "BiLinear";
  y2Transform: "Linear" | "Log10" | "BiLinear";
  xBiPos: number;
  xBiNeg: number;
  yBiPos: number;
  yBiNeg: number;
  y2BiPos: number;
  y2BiNeg: number;
  xMinorGridInterval: number;
  yMinorGridInterval: number;
  y2MinorGridInterval: number;
  useCrossAxes: boolean;
  axisWidth: number;
  minorGridWidth: number;
}

interface SavedGraphCard {
  id: number;
  name: string;
  graph: GraphForm;
  previewSrc: string;
  status: string;
  isRendering: boolean;
}

interface CsvPreview {
  total_rows: number;
  sample_rows: string[][];
}

const markerOptions: MarkerType[] = [
  "CircleFilled",
  "CircleEmpty",
  "Cross",
  "None",
];

const transformOptions: Array<GraphForm["xTransform"]> = [
  "Linear",
  "Log10",
  "BiLinear",
];

const tickModeOptions: Array<GraphForm["xTickMode"]> = [
  "Auto",
  "Explicit",
  "Interval",
];

const defaultSeries = (): SeriesForm => ({
  label: "Sample A",
  points: [
    [0, 0],
    [1, 10],
    [2, 25],
    [3, 15],
    [4, 30],
  ],
  markerType: "CircleFilled",
  markerSize: 7,
  drawLine: true,
  lineWidth: 3,
  color: "#ef4444",
  useSecondary: false,
});

const defaultGraph = (): GraphForm => ({
  canvasWidth: 1600,
  canvasHeight: 1000,
  baseFontSize: 32,
  fontName: "sans-serif",
  xDesc: "時間 [s]",
  yDesc: "カウント",
  y2Desc: "",
  xRangeStart: 0,
  xRangeEnd: 5,
  yRangeStart: 0,
  yRangeEnd: 40,
  y2RangeStart: 0,
  y2RangeEnd: 1,
  xLabels: 5,
  yLabels: 5,
  y2Labels: 0,
  xTickMode: "Auto",
  yTickMode: "Interval",
  y2TickMode: "Auto",
  xAutoTicks: 5,
  yAutoTicks: 5,
  y2AutoTicks: 0,
  xExplicitTicks: "0, 1, 2, 3, 4, 5",
  yExplicitTicks: "0, 10, 20, 30, 40",
  y2ExplicitTicks: "",
  xIntervalBase: 1,
  xIntervalOffset: 0,
  yIntervalBase: 2,
  yIntervalOffset: 0,
  y2IntervalBase: 1,
  y2IntervalOffset: 0,
  xTickLength: 15,
  yTickLength: 15,
  xFormatFixed: 1,
  yFormatFixed: 1,
  y2FormatFixed: 0,
  showLegend: true,
  xTransform: "Linear",
  yTransform: "Linear",
  y2Transform: "Linear",
  xBiPos: 1,
  xBiNeg: 1,
  yBiPos: 1,
  yBiNeg: 1,
  y2BiPos: 1,
  y2BiNeg: 1,
  xMinorGridInterval: 0.5,
  yMinorGridInterval: 0,
  y2MinorGridInterval: 0,
  useCrossAxes: false,
  axisWidth: 4,
  minorGridWidth: 1,
});

function parseNumberList(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .map((item) => Number.parseFloat(item))
    .filter((item) => Number.isFinite(item));
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function clampRange(start: number, end: number): { start: number; end: number } {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
    return { start: 0, end: 1 };
  }
  return start < end ? { start, end } : { start: end, end: start };
}

function buildTickMode(
  kind: GraphForm["xTickMode"],
  autoTicks: number,
  explicitTicks: string,
  intervalBase: number,
  intervalOffset: number,
): TickMode {
  if (kind === "Explicit") {
    return { Explicit: parseNumberList(explicitTicks) };
  }
  if (kind === "Interval") {
    return { Interval: { base: intervalBase, offset: intervalOffset } };
  }
  return { Auto: autoTicks };
}

function buildAxisTransform(
  kind: GraphForm["xTransform"],
  positiveInterval: number,
  negativeInterval: number,
): AxisTransform {
  if (kind === "BiLinear") {
    return { BiLinear: { pos_int: positiveInterval, neg_int: negativeInterval } };
  }
  return kind;
}

function cloneGraphForm(graph: GraphForm): GraphForm {
  return { ...graph };
}

let savedGraphCardSeed = 1;
let handleRenderPreviewTimer: number | undefined;

function createSavedGraphCard(name: string, graph: GraphForm): SavedGraphCard {
  return {
    id: savedGraphCardSeed++,
    name,
    graph: cloneGraphForm(graph),
    previewSrc: "",
    status: "未描画",
    isRendering: false,
  };
}

function getCsvColumnCount(rows: string[][]): number {
  return rows.reduce((maxColumns, row) => Math.max(maxColumns, row.length), 0);
}

function colorToHex(rgb: RGB): string {
  return `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function App() {
  const [graph, setGraph] = createSignal<GraphForm>(defaultGraph());
  const [seriesList, setSeriesList] = createSignal<SeriesForm[]>([defaultSeries()]);
  const [previewSrc, setPreviewSrc] = createSignal("");
  const [savedGraphs, setSavedGraphs] = createSignal<SavedGraphCard[]>([]);
  const [csvPreview, setCsvPreview] = createSignal<CsvPreview>({
    total_rows: 0,
    sample_rows: [],
  });
  const [statusMessage, setStatusMessage] = createSignal("設定を編集してプレビューを生成できます。");
  const [isRendering, setIsRendering] = createSignal(false);

  const payloadConfig = (sourceGraph: GraphForm = graph()) => {
    const current = sourceGraph;
    return {
      base_font_size: current.baseFontSize,
      x_desc: current.xDesc,
      y_desc: current.yDesc,
      y2_desc: current.y2Desc,
      x_range: clampRange(current.xRangeStart, current.xRangeEnd),
      y_range: clampRange(current.yRangeStart, current.yRangeEnd),
      y2_range: clampRange(current.y2RangeStart, current.y2RangeEnd),
      x_labels: current.xLabels,
      y_labels: current.yLabels,
      y2_labels: current.y2Labels,
      x_ticks_mode: buildTickMode(
        current.xTickMode,
        current.xAutoTicks,
        current.xExplicitTicks,
        current.xIntervalBase,
        current.xIntervalOffset,
      ),
      y_ticks_mode: buildTickMode(
        current.yTickMode,
        current.yAutoTicks,
        current.yExplicitTicks,
        current.yIntervalBase,
        current.yIntervalOffset,
      ),
      y2_ticks_mode: buildTickMode(
        current.y2TickMode,
        current.y2AutoTicks,
        current.y2ExplicitTicks,
        current.y2IntervalBase,
        current.y2IntervalOffset,
      ),
      x_tick_length: current.xTickLength,
      y_tick_length: current.yTickLength,
      font_name: current.fontName,
      x_format_fixed: current.xFormatFixed,
      y_format_fixed: current.yFormatFixed,
      y2_format_fixed: current.y2FormatFixed,
      show_legend: current.showLegend,
      x_transform: buildAxisTransform(current.xTransform, current.xBiPos, current.xBiNeg),
      y_transform: buildAxisTransform(current.yTransform, current.yBiPos, current.yBiNeg),
      y2_transform: buildAxisTransform(current.y2Transform, current.y2BiPos, current.y2BiNeg),
      x_minor_grid_interval: current.xMinorGridInterval > 0 ? current.xMinorGridInterval : null,
      y_minor_grid_interval: current.yMinorGridInterval > 0 ? current.yMinorGridInterval : null,
      y2_minor_grid_interval: current.y2MinorGridInterval > 0 ? current.y2MinorGridInterval : null,
      use_cross_axes: current.useCrossAxes,
      axis_width: current.axisWidth > 0 ? current.axisWidth : null,
      minor_grid_width: current.minorGridWidth > 0 ? current.minorGridWidth : null,
    };
  };

  const payloadSeries = () =>
    seriesList().map((series) => ({
      label: series.label,
      points: series.points,
      marker_type: series.markerType,
      marker_size: series.markerSize,
      draw_line: series.drawLine,
      line_width: series.lineWidth,
      color: hexToRgb(series.color),
      use_secondary: series.useSecondary,
    }));

  function updateSeries(index: number, updater: (series: SeriesForm) => SeriesForm) {
    setSeriesList((current) => current.map((series, seriesIndex) => (seriesIndex === index ? updater(series) : series)));
  }

  function updatePoint(seriesIndex: number, pointIndex: number, axis: 0 | 1, value: number) {
    updateSeries(seriesIndex, (series) => ({
      ...series,
      points: series.points.map((point, index) => (index === pointIndex ? ([axis === 0 ? value : point[0], axis === 1 ? value : point[1]] as Point) : point)),
    }));
  }

  function addPoint(seriesIndex: number) {
    updateSeries(seriesIndex, (series) => ({
      ...series,
      points: [...series.points, [0, 0]],
    }));
  }

  function removePoint(seriesIndex: number, pointIndex: number) {
    updateSeries(seriesIndex, (series) => ({
      ...series,
      points: series.points.filter((_, index) => index !== pointIndex),
    }));
  }

  function addSeries() {
    setSeriesList((current) => [
      ...current,
      {
        label: `Series ${current.length + 1}`,
        points: [[0, 0], [1, 1]],
        markerType: "CircleFilled",
        markerSize: 7,
        drawLine: true,
        lineWidth: 3,
        color: "#0f766e",
        useSecondary: false,
      },
    ]);
  }

  function duplicateSeries(index: number) {
    setSeriesList((current) => {
      const source = current[index];
      if (!source) {
        return current;
      }
      const next = current.slice();
      next.splice(index + 1, 0, {
        ...source,
        label: `${source.label} Copy`,
        points: source.points.map((point) => [...point] as Point),
      });
      return next;
    });
  }

  function removeSeries(index: number) {
    setSeriesList((current) => (current.length <= 1 ? current : current.filter((_, seriesIndex) => seriesIndex !== index)));
  }

  async function handleLoadCsv(seriesIndex: number) {
    const selected = await open({
      filters: [{ name: "CSV File", extensions: ["csv"] }],
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    try {
      const [preview, importedPoints] = await Promise.all([
        invoke<CsvPreview>("load_csv_preview", {
          filePath: selected,
        }),
        invoke<Point[]>("load_points_from_csv", {
          filePath: selected,
        }),
      ]);

      updateSeries(seriesIndex, (series) => ({
        ...series,
        points: importedPoints,
      }));

      setCsvPreview({
        total_rows: preview.total_rows,
        sample_rows: preview.sample_rows,
      });
      setStatusMessage(`CSV から ${importedPoints.length} 件の点を読み込みました。`);
    } catch (error) {
      setStatusMessage(`CSV 読み込みエラー: ${error}`);
    }
  }

  async function handleRenderPreview() {
    const currentGraph = graph();
    const currentSeries = seriesList();

    const validationErrors = validateGraphSettings(currentGraph);
    if (validationErrors.length > 0) {
      setStatusMessage(validationErrors.join(" "));
      return;
    }

    setIsRendering(true);
    setStatusMessage("tab2plot_lib で描画しています...");

    try {
      const preview = await invoke<string>("render_graph_preview", {
        config: payloadConfig(),
        seriesList: currentSeries.map((series) => ({
          label: series.label,
          points: series.points,
          marker_type: series.markerType,
          marker_size: series.markerSize,
          draw_line: series.drawLine,
          line_width: series.lineWidth,
          color: hexToRgb(series.color),
          use_secondary: series.useSecondary,
        })),
        width: currentGraph.canvasWidth,
        height: currentGraph.canvasHeight,
      });
      setPreviewSrc(preview);
      setStatusMessage("プレビューを更新しました。");
    } catch (error) {
      setStatusMessage(`描画エラー: ${error}`);
    } finally {
      setIsRendering(false);
    }
  }

  async function handleSavePng() {
    const currentGraph = graph();

    const validationErrors = validateGraphSettings(currentGraph);
    if (validationErrors.length > 0) {
      setStatusMessage(validationErrors.join(" "));
      return;
    }

    const path = await save({
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });

    if (!path || Array.isArray(path)) {
      return;
    }

    try {
      await invoke("save_graph_png", {
        config: payloadConfig(),
        seriesList: payloadSeries(),
        width: currentGraph.canvasWidth,
        height: currentGraph.canvasHeight,
        filePath: path,
      });
      setStatusMessage(`PNG を保存しました: ${path}`);
    } catch (error) {
      setStatusMessage(`保存エラー: ${error}`);
    }
  }

  function validateGraphSettings(current: GraphForm): string[] {
    const errors: string[] = [];
    if (current.xTransform === "Log10" && current.xRangeStart <= 0 && current.xRangeEnd <= 0) {
      errors.push("X 軸の Log10 は正の範囲が必要です。");
    }
    if (current.yTransform === "Log10" && current.yRangeStart <= 0 && current.yRangeEnd <= 0) {
      errors.push("Y 軸の Log10 は正の範囲が必要です。");
    }
    if (current.y2Transform === "Log10" && current.y2RangeStart <= 0 && current.y2RangeEnd <= 0) {
      errors.push("Y2 軸の Log10 は正の範囲が必要です。");
    }
    return errors;
  }

  function addSavedGraphCard() {
    const currentGraph = cloneGraphForm(graph());
    setSavedGraphs((current) => [
      ...current,
      createSavedGraphCard(`Graph ${current.length + 1}`, currentGraph),
    ]);
    setStatusMessage("現在の設定を保存グラフに追加しました。");
  }

  function duplicateSavedGraphCard(index: number) {
    setSavedGraphs((current) => {
      const source = current[index];
      if (!source) {
        return current;
      }

      const next = current.slice();
      next.splice(index + 1, 0, {
        id: savedGraphCardSeed++,
        name: `${source.name} Copy`,
        graph: cloneGraphForm(source.graph),
        previewSrc: source.previewSrc,
        status: source.status,
        isRendering: false,
      });
      return next;
    });
  }

  function removeSavedGraphCard(index: number) {
    setSavedGraphs((current) => current.filter((_, graphIndex) => graphIndex !== index));
  }

  function loadSavedGraphCard(index: number) {
    const card = savedGraphs()[index];
    if (!card) {
      return;
    }

    setGraph(cloneGraphForm(card.graph));
    setStatusMessage(`保存グラフ「${card.name}」を編集画面に読み込みました。`);
  }

  async function renderSavedGraphCard(index: number) {
    const card = savedGraphs()[index];
    if (!card) {
      return;
    }

    const validationErrors = validateGraphSettings(card.graph);
    if (validationErrors.length > 0) {
      setSavedGraphs((current) =>
        current.map((item, graphIndex) =>
          graphIndex === index
            ? { ...item, status: validationErrors.join(" "), isRendering: false }
            : item,
        ),
      );
      return;
    }

    setSavedGraphs((current) =>
      current.map((item, graphIndex) => (graphIndex === index ? { ...item, isRendering: true, status: "描画中..." } : item)),
    );

    try {
      const preview = await invoke<string>("render_graph_preview", {
        config: payloadConfig(card.graph),
        seriesList: payloadSeries(),
        width: card.graph.canvasWidth,
        height: card.graph.canvasHeight,
      });

      setSavedGraphs((current) =>
        current.map((item, graphIndex) =>
          graphIndex === index
            ? { ...item, previewSrc: preview, status: "プレビュー更新済み", isRendering: false }
            : item,
        ),
      );
    } catch (error) {
      setSavedGraphs((current) =>
        current.map((item, graphIndex) =>
          graphIndex === index ? { ...item, status: `描画エラー: ${error}`, isRendering: false } : item,
        ),
      );
    }
  }

  async function renderAllSavedGraphs() {
    const cards = savedGraphs();

    if (cards.length === 0) {
      setStatusMessage("保存グラフがないため、一括描画はできません。");
      return;
    }

    setStatusMessage("保存グラフを順に描画しています...");
    for (let index = 0; index < cards.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await renderSavedGraphCard(index);
    }
    setStatusMessage("保存グラフの一括描画が完了しました。");
  }

  createEffect(() => {
    graph();
    seriesList();
    if (handleRenderPreviewTimer !== undefined) {
      window.clearTimeout(handleRenderPreviewTimer);
    }
    handleRenderPreviewTimer = window.setTimeout(() => {
      void handleRenderPreview();
    }, 350);
  });

  return (
    <main class="app-shell">
      <section class="hero">
        <div>
          <p class="eyebrow">tab2plot workspace</p>
          <h1>tab2plot_lib を直接操作するグラフ編集画面</h1>
          <p class="hero-copy">
            Rust の描画エンジンにそのまま設定を送り、プレビューと PNG 出力を同じデータで扱います。
          </p>
        </div>
        <div class="hero-actions">
          <button class="primary-button" onClick={handleRenderPreview} disabled={isRendering()}>
            {isRendering() ? "描画中..." : "プレビュー更新"}
          </button>
          <button class="secondary-button" onClick={addSavedGraphCard}>
            現在を保存グラフに追加
          </button>
          <button class="secondary-button" onClick={renderAllSavedGraphs}>
            保存グラフを一括描画
          </button>
          <button class="secondary-button" onClick={handleSavePng}>
            PNG を保存
          </button>
        </div>
      </section>

      <section class="workspace-grid">
        <div class="editor-column">
          <div class="panel">
            <div class="panel-header">
              <h2>キャンバス</h2>
              <span>描画サイズと見た目</span>
            </div>
            <div class="field-grid two-up">
              <label>
                <span>幅</span>
                <input type="number" min="400" step="10" value={graph().canvasWidth} onInput={(event) => setGraph((current) => ({ ...current, canvasWidth: Number.parseInt(event.currentTarget.value) || 1600 }))} />
              </label>
              <label>
                <span>高さ</span>
                <input type="number" min="300" step="10" value={graph().canvasHeight} onInput={(event) => setGraph((current) => ({ ...current, canvasHeight: Number.parseInt(event.currentTarget.value) || 1000 }))} />
              </label>
              <label>
                <span>ベースフォントサイズ</span>
                <input type="number" min="10" step="1" value={graph().baseFontSize} onInput={(event) => setGraph((current) => ({ ...current, baseFontSize: Number.parseInt(event.currentTarget.value) || 32 }))} />
              </label>
              <label>
                <span>フォント名</span>
                <input type="text" value={graph().fontName} onInput={(event) => setGraph((current) => ({ ...current, fontName: event.currentTarget.value }))} />
              </label>
              <label class="toggle-row">
                <span>凡例を表示</span>
                <input type="checkbox" checked={graph().showLegend} onChange={(event) => setGraph((current) => ({ ...current, showLegend: event.currentTarget.checked }))} />
              </label>
              <label class="toggle-row">
                <span>十字軸モード</span>
                <input type="checkbox" checked={graph().useCrossAxes} onChange={(event) => setGraph((current) => ({ ...current, useCrossAxes: event.currentTarget.checked }))} />
              </label>
              <label>
                <span>軸の太さ</span>
                <input type="number" min="0" step="0.5" value={graph().axisWidth} onInput={(event) => setGraph((current) => ({ ...current, axisWidth: Number.parseFloat(event.currentTarget.value) || 0 }))} />
              </label>
              <label>
                <span>補助線の太さ</span>
                <input type="number" min="0" step="0.5" value={graph().minorGridWidth} onInput={(event) => setGraph((current) => ({ ...current, minorGridWidth: Number.parseFloat(event.currentTarget.value) || 0 }))} />
              </label>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h2>軸設定</h2>
              <span>ラベル、範囲、目盛り、変換</span>
            </div>
            <div class="axis-card">
              <h3>X 軸</h3>
              <div class="field-grid three-up">
                <label><span>ラベル</span><input type="text" value={graph().xDesc} onInput={(event) => setGraph((current) => ({ ...current, xDesc: event.currentTarget.value }))} /></label>
                <label><span>範囲開始</span><input type="number" step="0.1" value={graph().xRangeStart} onInput={(event) => setGraph((current) => ({ ...current, xRangeStart: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
                <label><span>範囲終了</span><input type="number" step="0.1" value={graph().xRangeEnd} onInput={(event) => setGraph((current) => ({ ...current, xRangeEnd: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>ラベル数</span><input type="number" min="0" step="1" value={graph().xLabels} onInput={(event) => setGraph((current) => ({ ...current, xLabels: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>Tick モード</span>
                    <select value={graph().xTickMode} onChange={(event) => setGraph((current) => ({ ...current, xTickMode: event.currentTarget.value as GraphForm["xTickMode"] }))}>
                    <For each={tickModeOptions}>{(option) => <option value={option}>{option}</option>}</For>
                  </select>
                </label>
                <label><span>表示桁数</span><input type="number" min="0" step="1" value={graph().xFormatFixed} onInput={(event) => setGraph((current) => ({ ...current, xFormatFixed: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>目盛り長さ</span><input type="number" min="0" step="1" value={graph().xTickLength} onInput={(event) => setGraph((current) => ({ ...current, xTickLength: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>変換</span>
                  <select value={graph().xTransform} onChange={(event) => setGraph((current) => ({ ...current, xTransform: event.currentTarget.value as GraphForm["xTransform"] }))}>
                    <For each={transformOptions}>{(option) => <option value={option}>{option}</option>}</For>
                  </select>
                </label>
                <label><span>BiLinear +</span><input type="number" step="0.1" value={graph().xBiPos} onInput={(event) => setGraph((current) => ({ ...current, xBiPos: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>BiLinear -</span><input type="number" step="0.1" value={graph().xBiNeg} onInput={(event) => setGraph((current) => ({ ...current, xBiNeg: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>補助線間隔</span><input type="number" step="0.1" value={graph().xMinorGridInterval} onInput={(event) => setGraph((current) => ({ ...current, xMinorGridInterval: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
              </div>
              {graph().xTickMode === "Explicit" && (
                <label class="full-width">
                  <span>明示的な目盛り</span>
                  <textarea value={graph().xExplicitTicks} onInput={(event) => setGraph((current) => ({ ...current, xExplicitTicks: event.currentTarget.value }))} />
                </label>
              )}
              {graph().xTickMode === "Interval" && (
                <div class="field-grid two-up compact">
                  <label><span>Base</span><input type="number" step="0.1" value={graph().xIntervalBase} onInput={(event) => setGraph((current) => ({ ...current, xIntervalBase: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                  <label><span>Offset</span><input type="number" step="0.1" value={graph().xIntervalOffset} onInput={(event) => setGraph((current) => ({ ...current, xIntervalOffset: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
                </div>
              )}
            </div>

            <div class="axis-card">
              <h3>Y 軸</h3>
              <div class="field-grid three-up">
                <label><span>ラベル</span><input type="text" value={graph().yDesc} onInput={(event) => setGraph((current) => ({ ...current, yDesc: event.currentTarget.value }))} /></label>
                <label><span>範囲開始</span><input type="number" step="0.1" value={graph().yRangeStart} onInput={(event) => setGraph((current) => ({ ...current, yRangeStart: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
                <label><span>範囲終了</span><input type="number" step="0.1" value={graph().yRangeEnd} onInput={(event) => setGraph((current) => ({ ...current, yRangeEnd: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>ラベル数</span><input type="number" min="0" step="1" value={graph().yLabels} onInput={(event) => setGraph((current) => ({ ...current, yLabels: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>Tick モード</span>
                    <select value={graph().yTickMode} onChange={(event) => setGraph((current) => ({ ...current, yTickMode: event.currentTarget.value as GraphForm["yTickMode"] }))}>
                    <For each={tickModeOptions}>{(option) => <option value={option}>{option}</option>}</For>
                  </select>
                </label>
                <label><span>表示桁数</span><input type="number" min="0" step="1" value={graph().yFormatFixed} onInput={(event) => setGraph((current) => ({ ...current, yFormatFixed: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>目盛り長さ</span><input type="number" min="0" step="1" value={graph().yTickLength} onInput={(event) => setGraph((current) => ({ ...current, yTickLength: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>変換</span>
                  <select value={graph().yTransform} onChange={(event) => setGraph((current) => ({ ...current, yTransform: event.currentTarget.value as GraphForm["yTransform"] }))}>
                    <For each={transformOptions}>{(option) => <option value={option}>{option}</option>}</For>
                  </select>
                </label>
                <label><span>BiLinear +</span><input type="number" step="0.1" value={graph().yBiPos} onInput={(event) => setGraph((current) => ({ ...current, yBiPos: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>BiLinear -</span><input type="number" step="0.1" value={graph().yBiNeg} onInput={(event) => setGraph((current) => ({ ...current, yBiNeg: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>補助線間隔</span><input type="number" step="0.1" value={graph().yMinorGridInterval} onInput={(event) => setGraph((current) => ({ ...current, yMinorGridInterval: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
              </div>
              {graph().yTickMode === "Explicit" && (
                <label class="full-width">
                  <span>明示的な目盛り</span>
                  <textarea value={graph().yExplicitTicks} onInput={(event) => setGraph((current) => ({ ...current, yExplicitTicks: event.currentTarget.value }))} />
                </label>
              )}
              {graph().yTickMode === "Interval" && (
                <div class="field-grid two-up compact">
                  <label><span>Base</span><input type="number" step="0.1" value={graph().yIntervalBase} onInput={(event) => setGraph((current) => ({ ...current, yIntervalBase: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                  <label><span>Offset</span><input type="number" step="0.1" value={graph().yIntervalOffset} onInput={(event) => setGraph((current) => ({ ...current, yIntervalOffset: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
                </div>
              )}
            </div>

            <div class="axis-card">
              <h3>Y2 軸</h3>
              <div class="field-grid three-up">
                <label><span>ラベル</span><input type="text" value={graph().y2Desc} onInput={(event) => setGraph((current) => ({ ...current, y2Desc: event.currentTarget.value }))} /></label>
                <label><span>範囲開始</span><input type="number" step="0.1" value={graph().y2RangeStart} onInput={(event) => setGraph((current) => ({ ...current, y2RangeStart: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
                <label><span>範囲終了</span><input type="number" step="0.1" value={graph().y2RangeEnd} onInput={(event) => setGraph((current) => ({ ...current, y2RangeEnd: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>ラベル数</span><input type="number" min="0" step="1" value={graph().y2Labels} onInput={(event) => setGraph((current) => ({ ...current, y2Labels: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>Tick モード</span>
                    <select value={graph().y2TickMode} onChange={(event) => setGraph((current) => ({ ...current, y2TickMode: event.currentTarget.value as GraphForm["y2TickMode"] }))}>
                    <For each={tickModeOptions}>{(option) => <option value={option}>{option}</option>}</For>
                  </select>
                </label>
                <label><span>表示桁数</span><input type="number" min="0" step="1" value={graph().y2FormatFixed} onInput={(event) => setGraph((current) => ({ ...current, y2FormatFixed: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                <label><span>変換</span>
                  <select value={graph().y2Transform} onChange={(event) => setGraph((current) => ({ ...current, y2Transform: event.currentTarget.value as GraphForm["y2Transform"] }))}>
                    <For each={transformOptions}>{(option) => <option value={option}>{option}</option>}</For>
                  </select>
                </label>
                <label><span>BiLinear +</span><input type="number" step="0.1" value={graph().y2BiPos} onInput={(event) => setGraph((current) => ({ ...current, y2BiPos: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>BiLinear -</span><input type="number" step="0.1" value={graph().y2BiNeg} onInput={(event) => setGraph((current) => ({ ...current, y2BiNeg: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                <label><span>補助線間隔</span><input type="number" step="0.1" value={graph().y2MinorGridInterval} onInput={(event) => setGraph((current) => ({ ...current, y2MinorGridInterval: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
              </div>
              {graph().y2TickMode === "Explicit" && (
                <label class="full-width">
                  <span>明示的な目盛り</span>
                  <textarea value={graph().y2ExplicitTicks} onInput={(event) => setGraph((current) => ({ ...current, y2ExplicitTicks: event.currentTarget.value }))} />
                </label>
              )}
              {graph().y2TickMode === "Interval" && (
                <div class="field-grid two-up compact">
                  <label><span>Base</span><input type="number" step="0.1" value={graph().y2IntervalBase} onInput={(event) => setGraph((current) => ({ ...current, y2IntervalBase: Number.parseFloat(event.currentTarget.value) || 1 }))} /></label>
                  <label><span>Offset</span><input type="number" step="0.1" value={graph().y2IntervalOffset} onInput={(event) => setGraph((current) => ({ ...current, y2IntervalOffset: Number.parseFloat(event.currentTarget.value) || 0 }))} /></label>
                </div>
              )}
            </div>
          </div>

          <div class="panel series-panel">
            <div class="panel-header with-actions">
              <div>
                <h2>系列</h2>
                <span>tab2plot_lib の SeriesData に対応</span>
              </div>
              <button class="secondary-button" onClick={addSeries}>系列を追加</button>
            </div>

            <For each={seriesList()}>
              {(series, seriesIndex) => (
                <div class="series-card">
                  <div class="series-toolbar">
                    <input
                      type="text"
                      value={series.label}
                      onInput={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, label: event.currentTarget.value }))}
                    />
                    <label class="toggle-row compact-toggle">
                      <span>右軸</span>
                      <input type="checkbox" checked={series.useSecondary} onChange={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, useSecondary: event.currentTarget.checked }))} />
                    </label>
                    <button class="ghost-button" onClick={() => handleLoadCsv(seriesIndex())}>CSV 読込</button>
                    <button class="ghost-button" onClick={() => duplicateSeries(seriesIndex())}>複製</button>
                    <button class="danger-button" onClick={() => removeSeries(seriesIndex())}>削除</button>
                  </div>

                  <div class="field-grid four-up">
                    <label>
                      <span>マーカー</span>
                      <select value={series.markerType} onChange={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, markerType: event.currentTarget.value as MarkerType }))}>
                        <For each={markerOptions}>{(option) => <option value={option}>{option}</option>}</For>
                      </select>
                    </label>
                    <label><span>サイズ</span><input type="number" min="0" step="1" value={series.markerSize} onInput={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, markerSize: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                    <label class="toggle-row"><span>線を描く</span><input type="checkbox" checked={series.drawLine} onChange={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, drawLine: event.currentTarget.checked }))} /></label>
                    <label><span>線の太さ</span><input type="number" min="0" step="1" value={series.lineWidth} onInput={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, lineWidth: Number.parseInt(event.currentTarget.value) || 0 }))} /></label>
                    <label>
                      <span>色</span>
                      <input type="color" value={series.color} onInput={(event) => updateSeries(seriesIndex(), (current) => ({ ...current, color: event.currentTarget.value }))} />
                    </label>
                  </div>

                  <div class="point-table-wrap">
                    <table class="point-table">
                      <thead>
                        <tr>
                          <th>X</th>
                          <th>Y</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={series.points}>
                          {(point, pointIndex) => (
                            <tr>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={point[0]}
                                  onInput={(event) => updatePoint(seriesIndex(), pointIndex(), 0, Number.parseFloat(event.currentTarget.value) || 0)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={point[1]}
                                  onInput={(event) => updatePoint(seriesIndex(), pointIndex(), 1, Number.parseFloat(event.currentTarget.value) || 0)}
                                />
                              </td>
                              <td>
                                <button class="tiny-button" onClick={() => removePoint(seriesIndex(), pointIndex())}>削除</button>
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>

                  <button class="secondary-button full-width-button" onClick={() => addPoint(seriesIndex())}>点を追加</button>
                </div>
              )}
            </For>
          </div>

          <div class="panel csv-panel">
            <div class="panel-header with-actions">
              <div>
                <h2>CSV プレビュー</h2>
                <span>読み込んだ元データをそのまま確認</span>
              </div>
              <span>{csvPreview().total_rows} 行</span>
            </div>
            <p>{csvPreview().sample_rows.length > 0 ? "先頭の行を表形式で表示しています。" : "まだ CSV が読み込まれていません。"}</p>
            <div class="csv-table-wrap">
              <table class="csv-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <For each={Array.from({ length: getCsvColumnCount(csvPreview().sample_rows) })}>
                      {(_, index) => <th>列 {index() + 1}</th>}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <For each={csvPreview().sample_rows}>
                    {(row, rowIndex) => (
                      <tr>
                        <td>{rowIndex() + 1}</td>
                        <For each={Array.from({ length: getCsvColumnCount(csvPreview().sample_rows) })}>
                          {(_, columnIndex) => <td>{row[columnIndex()] ?? ""}</td>}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel status-panel">
            <div class="panel-header">
              <h2>状態</h2>
              <span>Rust 側の結果</span>
            </div>
            <p>{statusMessage()}</p>
            <div class="meta-grid">
              <div>
                <strong>{seriesList().length}</strong>
                <span>系列</span>
              </div>
              <div>
                <strong>{seriesList().reduce((count, series) => count + series.points.length, 0)}</strong>
                <span>点</span>
              </div>
              <div>
                <strong>{graph().canvasWidth}×{graph().canvasHeight}</strong>
                <span>出力サイズ</span>
              </div>
            </div>
          </div>
        </div>

        <div class="preview-column">
          <div class="panel preview-panel">
            <div class="panel-header with-actions">
              <div>
                <h2>プレビュー</h2>
                <span>レンダリング結果の確認</span>
              </div>
              <button class="secondary-button" onClick={handleRenderPreview} disabled={isRendering()}>
                {isRendering() ? "更新中..." : "再描画"}
              </button>
            </div>
            <Show when={previewSrc()} fallback={<div class="empty-preview">プレビューを生成するとここに表示されます。</div>}>
              <img class="preview-image" src={previewSrc()} alt="tab2plot preview" />
            </Show>
          </div>

          <div class="panel gallery-panel">
            <div class="panel-header with-actions">
              <div>
                <h2>保存グラフ</h2>
                <span>複数グラフをまとめて作成・比較</span>
              </div>
              <button class="secondary-button" onClick={renderAllSavedGraphs} disabled={savedGraphs().length === 0}>
                まとめて更新
              </button>
            </div>

            <Show when={savedGraphs().length > 0} fallback={<div class="empty-preview">現在の設定を保存グラフに追加すると、ここに複数グラフが並びます。</div>}>
              <div class="gallery-grid">
                <For each={savedGraphs()}>
                  {(card, index) => (
                    <article class="graph-card">
                      <div class="graph-card-header">
                        <input
                          class="graph-card-name"
                          type="text"
                          value={card.name}
                          onInput={(event) =>
                            setSavedGraphs((current) =>
                              current.map((item, graphIndex) =>
                                graphIndex === index() ? { ...item, name: event.currentTarget.value } : item,
                              ),
                            )
                          }
                        />
                        <span class={card.isRendering ? "status-chip busy" : "status-chip"}>{card.isRendering ? "描画中" : card.status}</span>
                      </div>
                      <div class="graph-card-meta">
                        <span>{card.graph.canvasWidth}×{card.graph.canvasHeight}</span>
                        <span>{card.graph.showLegend ? "凡例あり" : "凡例なし"}</span>
                      </div>
                      <div class="graph-card-preview">
                        <Show when={card.previewSrc} fallback={<div class="graph-card-placeholder">未描画</div>}>
                          <img class="preview-image" src={card.previewSrc} alt={card.name} />
                        </Show>
                      </div>
                      <div class="graph-card-actions">
                        <button class="tiny-button" onClick={() => loadSavedGraphCard(index())}>読み込み</button>
                        <button class="tiny-button" onClick={() => renderSavedGraphCard(index())}>
                          更新
                        </button>
                        <button class="tiny-button" onClick={() => duplicateSavedGraphCard(index())}>複製</button>
                        <button class="danger-button" onClick={() => removeSavedGraphCard(index())}>削除</button>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
