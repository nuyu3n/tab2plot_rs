import { createEffect, createSignal, For, Show, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  RotateCcw,
  Save,
  Play,
  FolderOpen,
  Settings,
  Plus,
  Trash2,
  Layers,
  Sliders,
  Maximize2,
  RefreshCw,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-solid";
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
  color: string;
  useSecondary: boolean;
}

interface AppGraphState {
  canvasWidth: number;
  canvasHeight: number;
  baseFontSize: number;
  margin: number;
  xLabelArea: number;
  yLabelArea: number;
  rightMargin: number;

  showLegend: boolean;
  legendPosition: LegendPosition;
  legendBorderWidth: number;
  legendBackgroundOpacity: number;
  useCrossAxes: boolean;
  axisWidth: number;
  tickWidth: number;
  minorGridWidth: number;
  gridOpacity: number;

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

// GUI バッチタスク詳細定義
interface BatchTaskItem {
  id: string;
  expanded: boolean;
  input: string;
  output: string;
  configPath: string;
  overrideSize: boolean;
  width: number;
  height: number;

  // カスタム上書き設定
  overrideSettings: boolean;
  xDesc: string;
  xTransform: AxisTransformType;
  xRangeStart: number;
  xRangeEnd: number;
  xTickMode: "Auto" | "Interval" | "Explicit";
  xIntervalBase: number;
  xMinorGridInterval: number;

  yDesc: string;
  yTransform: AxisTransformType;
  yRangeStart: number;
  yRangeEnd: number;
  yTickMode: "Auto" | "Interval" | "Explicit";
  yIntervalBase: number;
  yMinorGridInterval: number;

  hasSecondary: boolean;
  y2Desc: string;
  y2Transform: AxisTransformType;
  y2RangeStart: number;
  y2RangeEnd: number;
  y2TickMode: "Auto" | "Interval" | "Explicit";
  y2IntervalBase: number;
  y2MinorGridInterval: number;

  showLegend: boolean;
  legendPosition: LegendPosition;
  useCrossAxes: boolean;
}

const defaultColors = [
  "#0066cc",
  "#cc3300",
  "#00994c",
  "#e69f00",
  "#9400d3",
  "#d94389",
];

const initialTableText = `time\tch1 (sin)\tch2 (cos)
0.0\t0.00\t1.00
0.5\t0.48\t0.88
1.0\t0.84\t0.54
1.5\t1.00\t0.07
2.0\t0.91\t-0.42
2.5\t0.60\t-0.80
3.0\t0.14\t-0.99
3.5\t-0.35\t-0.94
4.0\t-0.76\t-0.65
4.5\t-0.98\t-0.21
5.0\t-0.96\t0.28
5.5\t-0.71\t0.71
6.0\t-0.28\t0.96`;

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
  legendBorderWidth: 3,
  legendBackgroundOpacity: 0.8,
  useCrossAxes: false,
  axisWidth: 3,
  tickWidth: 3,
  minorGridWidth: 1,
  gridOpacity: 0.3,

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

function rgbToHex(rgb?: [number, number, number]): string {
  if (!rgb || rgb.length < 3) return "#0066cc";
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
      .join("")
  );
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
  const [seriesList, setSeriesList] = createSignal<SeriesItem[]>([]);
  const [rawText, setRawText] = createSignal(initialTableText);
  const [activeTab, setActiveTab] = createSignal<
    "data" | "axes" | "layout" | "batch" | "settings"
  >("data");
  const [previewSrc, setPreviewSrc] = createSignal("");
  const [statusMessage, setStatusMessage] = createSignal("準備完了");
  const [isRendering, setIsRendering] = createSignal(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = createSignal(true);

  // GUI バッチタスクリスト
  const [batchTasks, setBatchTasks] = createSignal<BatchTaskItem[]>([
    {
      id: "1",
      expanded: false,
      input: "samples/wave.tsv",
      output: "dist/wave.png",
      configPath: "",
      overrideSize: false,
      width: 1920,
      height: 1440,
      overrideSettings: true,
      xDesc: "時間 [s]",
      xTransform: "Linear",
      xRangeStart: 0,
      xRangeEnd: 6,
      xTickMode: "Interval",
      xIntervalBase: 1,
      xMinorGridInterval: 0.5,
      yDesc: "電圧 [V]",
      yTransform: "Linear",
      yRangeStart: -1.2,
      yRangeEnd: 1.2,
      yTickMode: "Interval",
      yIntervalBase: 0.5,
      yMinorGridInterval: 0.25,
      hasSecondary: false,
      y2Desc: "",
      y2Transform: "Linear",
      y2RangeStart: 0,
      y2RangeEnd: 1,
      y2TickMode: "Auto",
      y2IntervalBase: 1,
      y2MinorGridInterval: 0,
      showLegend: true,
      legendPosition: "UpperRight",
      useCrossAxes: false,
    },
    {
      id: "2",
      expanded: false,
      input: "samples/bode.tsv",
      output: "dist/bode.png",
      configPath: "",
      overrideSize: false,
      width: 1920,
      height: 1440,
      overrideSettings: true,
      xDesc: "周波数 [Hz]",
      xTransform: "Log10",
      xRangeStart: 10,
      xRangeEnd: 100000,
      xTickMode: "Explicit",
      xIntervalBase: 10,
      xMinorGridInterval: 0,
      yDesc: "利得 [dB]",
      yTransform: "Linear",
      yRangeStart: -45,
      yRangeEnd: 5,
      yTickMode: "Interval",
      yIntervalBase: 10,
      yMinorGridInterval: 0,
      hasSecondary: false,
      y2Desc: "",
      y2Transform: "Linear",
      y2RangeStart: 0,
      y2RangeEnd: 1,
      y2TickMode: "Auto",
      y2IntervalBase: 1,
      y2MinorGridInterval: 0,
      showLegend: true,
      legendPosition: "UpperRight",
      useCrossAxes: false,
    },
  ]);

  // 初期化（ストレージから復元）
  onMount(() => {
    const savedGraph = localStorage.getItem("tab2plot_graph_state");
    const savedSeries = localStorage.getItem("tab2plot_series_list");
    const savedText = localStorage.getItem("tab2plot_raw_text");
    const savedBatch = localStorage.getItem("tab2plot_batch_tasks");

    if (savedGraph) {
      try {
        setGraph(JSON.parse(savedGraph));
      } catch {}
    }
    if (savedText) {
      setRawText(savedText);
    }
    if (savedBatch) {
      try {
        setBatchTasks(JSON.parse(savedBatch));
      } catch {}
    }

    if (savedSeries) {
      try {
        setSeriesList(JSON.parse(savedSeries));
      } catch {
        handleParseRawText();
      }
    } else {
      handleParseRawText();
    }
  });

  // LocalStorage 自動保存
  createEffect(() => {
    if (!autoSaveEnabled()) return;
    localStorage.setItem("tab2plot_graph_state", JSON.stringify(graph()));
    localStorage.setItem("tab2plot_series_list", JSON.stringify(seriesList()));
    localStorage.setItem("tab2plot_raw_text", rawText());
    localStorage.setItem("tab2plot_batch_tasks", JSON.stringify(batchTasks()));
  });

  // 新規作成（初期化）
  const handleResetNew = () => {
    if (!confirm("現在の設定とデータを初期化して新規作成しますか？")) return;
    setGraph({ ...defaultGraphState });
    setRawText(initialTableText);
    handleParseRawText();
    setStatusMessage("新規作成しました");
  };

  // テキストエリアでの Tab キー入力処理（インデント挿入）
  const handleTextareaKeyDown = (
    e: KeyboardEvent & { currentTarget: HTMLTextAreaElement },
  ) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updatedVal = val.substring(0, start) + "\t" + val.substring(end);
      setRawText(updatedVal);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
    }
  };

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
      tick_width: g.tickWidth,
      font_name: "",
      x_format_fixed: g.xFormatFixed,
      y_format_fixed: g.yFormatFixed,
      y2_format_fixed: g.y2FormatFixed,
      show_legend: g.showLegend,
      legend_position: g.legendPosition,
      legend_border_width: g.legendBorderWidth,
      legend_background_opacity: g.legendBackgroundOpacity,
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
      grid_opacity: g.gridOpacity,
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
    if (seriesList().length === 0) return;
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

  // TSV/CSV テキストのパース（系列の自動同期）
  async function handleParseRawText() {
    if (!rawText().trim()) return;
    try {
      const parsed = await invoke<any[]>("parse_table_data", {
        tableText: rawText(),
        delimiter: null,
        config: buildPayloadConfig(),
      });

      const currentStyles = seriesList();
      const nextList: SeriesItem[] = parsed.map((p, idx) => {
        const existing = currentStyles[idx];
        return {
          id: existing ? existing.id : String(Date.now() + idx),
          label: p.label || (existing ? existing.label : `Series ${idx + 1}`),
          points: p.points,
          markerType: existing ? existing.markerType : p.marker_type,
          markerSize: existing ? existing.markerSize : p.marker_size,
          lineStyle: existing ? existing.lineStyle : p.line_style,
          lineWidth: existing ? existing.lineWidth : p.line_width,
          color: existing
            ? existing.color
            : p.color
              ? rgbToHex(p.color)
              : defaultColors[idx % defaultColors.length],
          useSecondary: existing ? existing.useSecondary : p.use_secondary,
        };
      });

      setSeriesList(nextList);
      autoScaleRange(nextList);
      setStatusMessage(`${nextList.length} 系列をデータから読み込みました`);
    } catch (err) {
      setStatusMessage(`パースエラー: ${err}`);
    }
  }

  // ファイル読込
  async function handleImportFile() {
    const selected = await open({
      filters: [{ name: "Data File", extensions: ["tsv", "csv", "txt"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    try {
      const preview = await invoke<{ sample_rows: string[][] }>(
        "load_csv_preview",
        { filePath: selected },
      );
      const lines = preview.sample_rows.map((row) => row.join("\t")).join("\n");
      setRawText(lines);
      handleParseRawText();
      setStatusMessage(`読込完了: ${selected}`);
    } catch (err) {
      setStatusMessage(`読込失敗: ${err}`);
    }
  }

  // 自動範囲調整
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
      setStatusMessage(`保存成功: ${selected}`);
    } catch (err) {
      setStatusMessage(`保存失敗: ${err}`);
    }
  }

  // GUI バッチタスク追加
  const addBatchTask = () => {
    setBatchTasks((tasks) => [
      ...tasks,
      {
        id: String(Date.now()),
        expanded: true,
        input: "",
        output: "",
        configPath: "",
        overrideSize: false,
        width: graph().canvasWidth,
        height: graph().canvasHeight,
        overrideSettings: false,
        xDesc: graph().xDesc,
        xTransform: graph().xTransform,
        xRangeStart: graph().xRangeStart,
        xRangeEnd: graph().xRangeEnd,
        xTickMode: graph().xTickMode,
        xIntervalBase: graph().xIntervalBase,
        xMinorGridInterval: graph().xMinorGridInterval,
        yDesc: graph().yDesc,
        yTransform: graph().yTransform,
        yRangeStart: graph().yRangeStart,
        yRangeEnd: graph().yRangeEnd,
        yTickMode: graph().yTickMode,
        yIntervalBase: graph().yIntervalBase,
        yMinorGridInterval: graph().yMinorGridInterval,
        hasSecondary: false,
        y2Desc: graph().y2Desc,
        y2Transform: graph().y2Transform,
        y2RangeStart: graph().y2RangeStart,
        y2RangeEnd: graph().y2RangeEnd,
        y2TickMode: graph().y2TickMode,
        y2IntervalBase: graph().y2IntervalBase,
        y2MinorGridInterval: graph().y2MinorGridInterval,
        showLegend: graph().showLegend,
        legendPosition: graph().legendPosition,
        useCrossAxes: graph().useCrossAxes,
      },
    ]);
  };

  // GUI バッチ実行
  async function handleRunGuiBatch() {
    const tasks = batchTasks();
    if (tasks.length === 0) {
      alert("実行するタスクがありません。");
      return;
    }

    const batchPayload = {
      default_width: graph().canvasWidth,
      default_height: graph().canvasHeight,
      common: {
        base_font_size: graph().baseFontSize,
        axis_width: graph().axisWidth,
        minor_grid_width: graph().minorGridWidth,
        show_legend: graph().showLegend,
        legend_position: graph().legendPosition,
      },
      tasks: tasks.map((t) => {
        let taskConfig: any = {};
        if (t.overrideSettings) {
          taskConfig = {
            x_desc: t.xDesc,
            x_transform: t.xTransform,
            x_range: { start: t.xRangeStart, end: t.xRangeEnd },
            x_ticks_mode:
              t.xTickMode === "Interval"
                ? { Interval: { base: t.xIntervalBase, offset: 0 } }
                : { Auto: 8 },
            x_minor_grid_interval:
              t.xMinorGridInterval > 0 ? t.xMinorGridInterval : null,
            y_desc: t.yDesc,
            y_transform: t.yTransform,
            y_range: { start: t.yRangeStart, end: t.yRangeEnd },
            y_ticks_mode:
              t.yTickMode === "Interval"
                ? { Interval: { base: t.yIntervalBase, offset: 0 } }
                : { Auto: 8 },
            y_minor_grid_interval:
              t.yMinorGridInterval > 0 ? t.yMinorGridInterval : null,
            show_legend: t.showLegend,
            legend_position: t.legendPosition,
            use_cross_axes: t.useCrossAxes,
          };
          if (t.hasSecondary) {
            taskConfig.y2_desc = t.y2Desc;
            taskConfig.y2_transform = t.y2Transform;
            taskConfig.y2_range = { start: t.y2RangeStart, end: t.y2RangeEnd };
            taskConfig.y2_ticks_mode =
              t.y2TickMode === "Interval"
                ? { Interval: { base: t.y2IntervalBase, offset: 0 } }
                : { Auto: 8 };
            taskConfig.y2_minor_grid_interval =
              t.y2MinorGridInterval > 0 ? t.y2MinorGridInterval : null;
          }
        }

        return {
          input: t.input,
          output: t.output || undefined,
          config_path: t.configPath || undefined,
          width: t.overrideSize ? t.width : undefined,
          height: t.overrideSize ? t.height : undefined,
          config: t.overrideSettings ? taskConfig : undefined,
        };
      }),
    };

    try {
      await invoke("run_batch_json", {
        batchJson: JSON.stringify(batchPayload, null, 2),
        baseDir: null,
      });
      setStatusMessage(`バッチ完了: ${tasks.length} 枚のグラフを出力しました`);
    } catch (err) {
      setStatusMessage(`バッチ失敗: ${err}`);
    }
  }

  return (
    <div class="flex flex-col h-screen bg-slate-50 text-slate-800">
      {/* --- ヘッダー --- */}
      <header class="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between shadow-sm shrink-0">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <Sliders class="w-5 h-5 text-blue-600" />
            <h1 class="font-bold text-lg tracking-tight text-slate-900">
              tab2plot
            </h1>
          </div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            GUI v0.2
          </span>
        </div>

        {/* 状態ステータス */}
        <div class="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <span
            class={`w-2 h-2 rounded-full ${isRendering() ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
          />
          <span>{statusMessage()}</span>
        </div>

        {/* アクションボタン */}
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
            onClick={handleResetNew}
            title="新規作成（デフォルトに戻す）"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            新規作成
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
            onClick={triggerPreview}
            disabled={isRendering()}
          >
            <RefreshCw
              class={`w-3.5 h-3.5 ${isRendering() ? "animate-spin" : ""}`}
            />
            再描画
          </button>
          <button
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
            onClick={handleSaveSinglePng}
          >
            <Save class="w-3.5 h-3.5" />
            PNG 保存
          </button>
        </div>
      </header>

      {/* --- メインコンテンツ --- */}
      <main class="flex-1 grid grid-cols-[560px_1fr] overflow-hidden">
        {/* 左カラム: コントロールパネル */}
        <section class="bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* タブナビゲーション */}
          <div class="flex bg-slate-100/80 p-1 border-b border-slate-200 gap-1 shrink-0">
            <button
              class={`flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold rounded-md transition ${
                activeTab() === "data"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("data")}
            >
              <FileSpreadsheet class="w-4 h-4" />
              データ & 系列
            </button>
            <button
              class={`flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold rounded-md transition ${
                activeTab() === "axes"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("axes")}
            >
              <Sliders class="w-4 h-4" />軸 & スケール
            </button>
            <button
              class={`flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold rounded-md transition ${
                activeTab() === "layout"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("layout")}
            >
              <Maximize2 class="w-4 h-4" />
              余白 & スタイル
            </button>
            <button
              class={`flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-semibold rounded-md transition ${
                activeTab() === "batch"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("batch")}
            >
              <Layers class="w-4 h-4" />
              バッチ設定
            </button>
            <button
              class={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition ${
                activeTab() === "settings"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setActiveTab("settings")}
            >
              <Settings class="w-4 h-4" />
            </button>
          </div>

          {/* タブコンテンツ */}
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. データ & 系列 */}
            <Show when={activeTab() === "data"}>
              <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                <div class="flex justify-between items-center">
                  <h3 class="text-xs font-bold text-slate-800">
                    表データ入力 (TSV / CSV / スペース区切り)
                  </h3>
                  <span class="text-[11px] text-slate-500 font-mono">
                    Tabキー入力・日本語対応
                  </span>
                </div>
                <textarea
                  class="w-full h-40 bg-white border border-slate-300 rounded-md p-2.5 font-mono text-xs text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={rawText()}
                  onInput={(e) => setRawText(e.currentTarget.value)}
                  onKeyDown={handleTextareaKeyDown}
                />
                <div class="flex gap-2">
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium transition shadow-sm"
                    onClick={handleImportFile}
                  >
                    <FolderOpen class="w-3.5 h-3.5 text-slate-600" />
                    ファイルから読込
                  </button>
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition shadow-sm"
                    onClick={handleParseRawText}
                  >
                    <Play class="w-3.5 h-3.5" />
                    反映してパース
                  </button>
                  <button
                    class="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium transition ml-auto"
                    onClick={() => autoScaleRange()}
                  >
                    自動範囲調整
                  </button>
                </div>
              </div>

              {/* 系列スタイル一覧（データから自動生成） */}
              <div class="space-y-3">
                <div class="flex justify-between items-center px-1">
                  <h3 class="text-xs font-bold text-slate-800">
                    系列スタイル設定 ({seriesList().length} 系列検出)
                  </h3>
                  <span class="text-[11px] text-slate-500">
                    表データの列から自動生成
                  </span>
                </div>

                <For each={seriesList()}>
                  {(s, idx) => (
                    <div class="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2.5">
                      <div class="flex items-center gap-2">
                        <input
                          type="color"
                          class="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5 bg-white shrink-0"
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
                          class="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
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
                        <label class="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer ml-2">
                          <input
                            type="checkbox"
                            class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                      </div>

                      <div class="grid grid-cols-4 gap-2">
                        <label class="flex flex-col gap-1">
                          <span class="text-[11px] font-medium text-slate-500">
                            線種
                          </span>
                          <select
                            class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                            <option value="DashDot">一点鎖線</option>
                            <option value="None">線なし</option>
                          </select>
                        </label>

                        <label class="flex flex-col gap-1">
                          <span class="text-[11px] font-medium text-slate-500">
                            線幅 (px)
                          </span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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

                        <label class="flex flex-col gap-1">
                          <span class="text-[11px] font-medium text-slate-500">
                            マーカー
                          </span>
                          <select
                            class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                            <option value="CircleFilled">塗り円</option>
                            <option value="CircleEmpty">白抜き円</option>
                            <option value="Cross">十字 (Cross)</option>
                            <option value="None">なし</option>
                          </select>
                        </label>

                        <label class="flex flex-col gap-1">
                          <span class="text-[11px] font-medium text-slate-500">
                            サイズ
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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

            {/* 2. 軸 & スケール */}
            <Show when={activeTab() === "axes"}>
              {/* X軸 */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  X 軸 (横軸)
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">軸タイトル</span>
                    <input
                      type="text"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().xDesc}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xDesc: e.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">開始</span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().xRangeStart}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xRangeStart: parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">終了</span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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

                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">スケール</span>
                    <select
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().xTransform}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xTransform: e.currentTarget
                            .value as AxisTransformType,
                        }))
                      }
                    >
                      <option value="Linear">Linear (等間隔)</option>
                      <option value="Log10">Log10 (対数)</option>
                      <option value="BiLinear">BiLinear</option>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">目盛りモード</span>
                    <select
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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
                      <option value="Explicit">Explicit (明示)</option>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      補助グリッド間隔
                    </span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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
              </div>

              {/* Y軸 */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  Y 軸 (主軸)
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">軸タイトル</span>
                    <input
                      type="text"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().yDesc}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yDesc: e.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">開始</span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().yRangeStart}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yRangeStart: parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">終了</span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">スケール</span>
                    <select
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().yTransform}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yTransform: e.currentTarget
                            .value as AxisTransformType,
                        }))
                      }
                    >
                      <option value="Linear">Linear (等間隔)</option>
                      <option value="Log10">Log10 (対数)</option>
                      <option value="BiLinear">BiLinear</option>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">目盛りモード</span>
                    <select
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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
                      <option value="Explicit">Explicit (明示)</option>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      補助グリッド間隔
                    </span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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
              </div>

              {/* Y2軸 */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  Y2 軸 (第2Y軸 / 右軸)
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">右軸タイトル</span>
                    <input
                      type="text"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().y2Desc}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          y2Desc: e.currentTarget.value,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">開始</span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().y2RangeStart}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          y2RangeStart: parseFloat(e.currentTarget.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">終了</span>
                    <input
                      type="number"
                      step="any"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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

            {/* 3. 余白 & スタイル */}
            <Show when={activeTab() === "layout"}>
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  解像度 & 基本フォント
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">画像幅 (px)</span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().canvasWidth}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          canvasWidth: parseInt(e.currentTarget.value) || 1600,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      画像高さ (px)
                    </span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().canvasHeight}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          canvasHeight: parseInt(e.currentTarget.value) || 1200,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      フォントサイズ
                    </span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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

              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  余白エリア調整 (px)
                </h3>
                <div class="grid grid-cols-4 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">外周余白</span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().margin}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          margin: parseInt(e.currentTarget.value) || 60,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">X軸エリア</span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().xLabelArea}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          xLabelArea: parseInt(e.currentTarget.value) || 160,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">Y軸エリア</span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().yLabelArea}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          yLabelArea: parseInt(e.currentTarget.value) || 180,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">右側余白</span>
                    <input
                      type="number"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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

              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  線の太さ & 凡例
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">枠線の太さ</span>
                    <input
                      type="number"
                      step="0.5"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().axisWidth}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          axisWidth: parseFloat(e.currentTarget.value) || 3,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      目盛り線の太さ
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().tickWidth}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          tickWidth: parseFloat(e.currentTarget.value) || 3,
                        }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      グリッド線の濃さ
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                      value={graph().gridOpacity}
                      onInput={(e) =>
                        setGraph((g) => ({
                          ...g,
                          gridOpacity: parseFloat(e.currentTarget.value) || 0.3,
                        }))
                      }
                    />
                  </label>
                </div>

                <div class="flex items-center gap-6 pt-2">
                  <label class="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
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
                    凡例を表示
                  </label>
                  <label class="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
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
                    十字軸モード (Cross Axes)
                  </label>
                </div>
              </div>
            </Show>

            {/* 4. バッチ設定 (詳細フルGUIビルダー) */}
            <Show when={activeTab() === "batch"}>
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <div>
                    <h3 class="text-xs font-bold text-slate-800">
                      バッチ一括実行ビルダー
                    </h3>
                    <p class="text-[11px] text-slate-500">
                      各タスクの個別差分（軸・スケール・範囲）をGUIで完全設定
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium transition"
                      onClick={addBatchTask}
                    >
                      <Plus class="w-3.5 h-3.5" />
                      タスク追加
                    </button>
                    <button
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                      onClick={handleRunGuiBatch}
                    >
                      <Play class="w-3.5 h-3.5" />
                      バッチ一括実行
                    </button>
                  </div>
                </div>

                {/* タスク一覧 */}
                <div class="space-y-3">
                  <For each={batchTasks()}>
                    {(task, idx) => (
                      <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                        {/* タスクヘッダー */}
                        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                          <button
                            class="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-blue-600 transition"
                            onClick={() =>
                              setBatchTasks((tasks) =>
                                tasks.map((t, i) =>
                                  i === idx()
                                    ? { ...t, expanded: !t.expanded }
                                    : t,
                                ),
                              )
                            }
                          >
                            {task.expanded ? (
                              <ChevronDown class="w-4 h-4" />
                            ) : (
                              <ChevronRight class="w-4 h-4" />
                            )}
                            タスク #{idx() + 1}
                            <span class="text-[11px] font-normal text-slate-500">
                              ({task.input || "ファイル未選択"})
                            </span>
                          </button>
                          <button
                            class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            onClick={() =>
                              setBatchTasks((tasks) =>
                                tasks.filter((_, i) => i !== idx()),
                              )
                            }
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>

                        {/* 基本入出力 */}
                        <div class="grid grid-cols-2 gap-2.5">
                          <div class="flex flex-col gap-1">
                            <span class="text-[11px] text-slate-500">
                              入力ファイル (必須)
                            </span>
                            <div class="flex gap-1">
                              <input
                                type="text"
                                placeholder="samples/wave.tsv"
                                class="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                value={task.input}
                                onInput={(e) =>
                                  setBatchTasks((tasks) =>
                                    tasks.map((t, i) =>
                                      i === idx()
                                        ? { ...t, input: e.currentTarget.value }
                                        : t,
                                    ),
                                  )
                                }
                              />
                              <button
                                class="px-2 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
                                onClick={async () => {
                                  const sel = await open({
                                    filters: [
                                      {
                                        name: "Data",
                                        extensions: ["tsv", "csv", "txt"],
                                      },
                                    ],
                                  });
                                  if (sel && !Array.isArray(sel)) {
                                    setBatchTasks((tasks) =>
                                      tasks.map((t, i) =>
                                        i === idx() ? { ...t, input: sel } : t,
                                      ),
                                    );
                                  }
                                }}
                              >
                                <FolderOpen class="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </div>
                          </div>

                          <div class="flex flex-col gap-1">
                            <span class="text-[11px] text-slate-500">
                              出力先 (省略で同名PNG)
                            </span>
                            <input
                              type="text"
                              placeholder="dist/output.png"
                              class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                              value={task.output}
                              onInput={(e) =>
                                setBatchTasks((tasks) =>
                                  tasks.map((t, i) =>
                                    i === idx()
                                      ? { ...t, output: e.currentTarget.value }
                                      : t,
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* 詳細設定アコーディオン */}
                        <Show when={task.expanded}>
                          <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 pt-2">
                            <div class="flex items-center justify-between border-b pb-2">
                              <label class="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  class="rounded border-slate-300 text-blue-600"
                                  checked={task.overrideSettings}
                                  onChange={(e) =>
                                    setBatchTasks((tasks) =>
                                      tasks.map((t, i) =>
                                        i === idx()
                                          ? {
                                              ...t,
                                              overrideSettings:
                                                e.currentTarget.checked,
                                            }
                                          : t,
                                      ),
                                    )
                                  }
                                />
                                このタスクの個別設定を有効化 (差分上書き)
                              </label>

                              <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={task.overrideSize}
                                  onChange={(e) =>
                                    setBatchTasks((tasks) =>
                                      tasks.map((t, i) =>
                                        i === idx()
                                          ? {
                                              ...t,
                                              overrideSize:
                                                e.currentTarget.checked,
                                            }
                                          : t,
                                      ),
                                    )
                                  }
                                />
                                画像サイズ個別指定
                              </label>
                            </div>

                            {/* 外部JSON指定 */}
                            <div class="flex flex-col gap-1">
                              <span class="text-[11px] text-slate-500">
                                外部JSON設定ファイル (任意)
                              </span>
                              <div class="flex gap-1">
                                <input
                                  type="text"
                                  placeholder="samples/custom_config.json"
                                  class="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                  value={task.configPath}
                                  onInput={(e) =>
                                    setBatchTasks((tasks) =>
                                      tasks.map((t, i) =>
                                        i === idx()
                                          ? {
                                              ...t,
                                              configPath: e.currentTarget.value,
                                            }
                                          : t,
                                      ),
                                    )
                                  }
                                />
                                <button
                                  class="px-2 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
                                  onClick={async () => {
                                    const sel = await open({
                                      filters: [
                                        {
                                          name: "Config JSON",
                                          extensions: ["json"],
                                        },
                                      ],
                                    });
                                    if (sel && !Array.isArray(sel)) {
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? { ...t, configPath: sel }
                                            : t,
                                        ),
                                      );
                                    }
                                  }}
                                >
                                  <FolderOpen class="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              </div>
                            </div>

                            {/* 解像度個別指定 */}
                            <Show when={task.overrideSize}>
                              <div class="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-slate-200">
                                <label class="flex flex-col gap-1">
                                  <span class="text-[11px] text-slate-500">
                                    幅 (px)
                                  </span>
                                  <input
                                    type="number"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.width}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                width:
                                                  parseInt(
                                                    e.currentTarget.value,
                                                  ) || 1920,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                                <label class="flex flex-col gap-1">
                                  <span class="text-[11px] text-slate-500">
                                    高さ (px)
                                  </span>
                                  <input
                                    type="number"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.height}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                height:
                                                  parseInt(
                                                    e.currentTarget.value,
                                                  ) || 1440,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </Show>

                            {/* 軸個別設定 */}
                            <Show when={task.overrideSettings}>
                              {/* タスクX軸 */}
                              <div class="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                                <span class="text-xs font-bold text-slate-700">
                                  X 軸設定
                                </span>
                                <div class="grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    placeholder="タイトル"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.xDesc}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                xDesc: e.currentTarget.value,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="開始"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.xRangeStart}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                xRangeStart:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 0,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="終了"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.xRangeEnd}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                xRangeEnd:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 1,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div class="grid grid-cols-3 gap-2">
                                  <select
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.xTransform}
                                    onChange={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                xTransform: e.currentTarget
                                                  .value as AxisTransformType,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  >
                                    <option value="Linear">Linear</option>
                                    <option value="Log10">Log10 (対数)</option>
                                    <option value="BiLinear">BiLinear</option>
                                  </select>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="目盛り間隔"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.xIntervalBase}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                xIntervalBase:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 1,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="補助線間隔"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.xMinorGridInterval}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                xMinorGridInterval:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 0,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                              </div>

                              {/* タスクY軸 */}
                              <div class="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                                <span class="text-xs font-bold text-slate-700">
                                  Y 軸設定
                                </span>
                                <div class="grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    placeholder="タイトル"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.yDesc}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                yDesc: e.currentTarget.value,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="開始"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.yRangeStart}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                yRangeStart:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 0,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="終了"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.yRangeEnd}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                yRangeEnd:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 1,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div class="grid grid-cols-3 gap-2">
                                  <select
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.yTransform}
                                    onChange={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                yTransform: e.currentTarget
                                                  .value as AxisTransformType,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  >
                                    <option value="Linear">Linear</option>
                                    <option value="Log10">Log10</option>
                                    <option value="BiLinear">BiLinear</option>
                                  </select>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="目盛り間隔"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.yIntervalBase}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                yIntervalBase:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 1,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="補助線間隔"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task.yMinorGridInterval}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                yMinorGridInterval:
                                                  parseFloat(
                                                    e.currentTarget.value,
                                                  ) || 0,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                              </div>

                              {/* その他オプション */}
                              <div class="flex items-center gap-4 pt-1">
                                <label class="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={task.useCrossAxes}
                                    onChange={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                useCrossAxes:
                                                  e.currentTarget.checked,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  十字軸モード
                                </label>
                                <label class="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={task.showLegend}
                                    onChange={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx()
                                            ? {
                                                ...t,
                                                showLegend:
                                                  e.currentTarget.checked,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  凡例表示
                                </label>
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* 5. 設定 (Settings) */}
            <Show when={activeTab() === "settings"}>
              <div class="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-2">
                  アプリケーション設定
                </h3>

                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-xs font-semibold text-slate-800">
                      変更の自動保存 (LocalStorage)
                    </span>
                    <p class="text-[11px] text-slate-500">
                      パラメータの変更を自動でブラウザストレージに記録します
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={autoSaveEnabled()}
                    onChange={(e) =>
                      setAutoSaveEnabled(e.currentTarget.checked)
                    }
                  />
                </div>

                <div class="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition"
                    onClick={() => {
                      if (
                        confirm(
                          "ローカル保存データを全削除してリセットしますか？",
                        )
                      ) {
                        localStorage.clear();
                        location.reload();
                      }
                    }}
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    保存キャッシュをクリア
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </section>

        {/* 右カラム: プレビュー画面（黒バック） */}
        <section class="bg-zinc-950 flex flex-col h-full p-4 overflow-hidden">
          <div class="flex-1 border border-zinc-800 rounded-xl bg-black/80 flex items-center justify-center overflow-hidden p-2 relative shadow-inner">
            <Show
              when={previewSrc()}
              fallback={
                <div class="text-zinc-600 text-xs flex flex-col items-center gap-2">
                  <Eye class="w-6 h-6 text-zinc-700" />
                  描画結果がここにリアルタイム表示されます
                </div>
              }
            >
              <img
                src={previewSrc()}
                alt="Graph Preview"
                class="max-w-full max-h-full object-contain shadow-2xl rounded"
              />
            </Show>
          </div>

          <div class="flex justify-end gap-2 pt-3 text-[11px] text-zinc-400 font-mono">
            <div class="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
              {graph().canvasWidth} × {graph().canvasHeight} px
            </div>
            <div class="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
              系列: {seriesList().length} (計{" "}
              {seriesList().reduce((acc, s) => acc + s.points.length, 0)} 点)
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
