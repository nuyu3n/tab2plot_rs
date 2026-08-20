import {
  createEffect,
  createSignal,
  For,
  Index,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
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
  Check,
  FileCode,
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
  legendMargin: number;
  legendAreaSize: number;

  useCrossAxes: boolean;
  showCrossBorder: boolean;
  axisWidth: number;
  tickWidth: number;
  xTickLength: number;
  yTickLength: number;
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

interface BatchTaskItem {
  id: string;
  expanded: boolean;
  input: string;
  output: string;
  configPath: string;
  overrideSize: boolean;
  width: number;
  height: number;
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
  showCrossBorder: boolean;
}

const PRESET_COLORS: string[] = [
  "#0066cc",
  "#cc3300",
  "#00994c",
  "#e69f00",
  "#9400d3",
  "#d94389",
  "#17becf",
  "#8c564b",
  "#2ca02c",
  "#d62728",
  "#1f77b4",
  "#ff7f0e",
  "#000000",
  "#555555",
  "#888888",
  "#0284c7",
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
  legendMargin: 20,
  legendAreaSize: 50,

  useCrossAxes: false,
  showCrossBorder: false,
  axisWidth: 3,
  tickWidth: 3,
  xTickLength: 10,
  yTickLength: 10,
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
    parseInt(normalized.slice(0, 2), 16) || 0,
    parseInt(normalized.slice(2, 4), 16) || 0,
    parseInt(normalized.slice(4, 6), 16) || 0,
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

function NumberInput(props: {
  value: number;
  onValueChange: (val: number) => void;
  class?: string;
  placeholder?: string;
}) {
  const [text, setText] = createSignal(String(props.value ?? 0));

  createEffect(() => {
    setText(String(props.value ?? 0));
  });

  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const raw = e.currentTarget.value;
    setText(raw);
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      props.onValueChange(num);
    }
  };

  const handleBlur = () => {
    const num = parseFloat(text());
    if (isNaN(num)) {
      setText(String(props.value));
    } else {
      props.onValueChange(num);
      setText(String(num));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      class={
        props.class ||
        "bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white focus:border-blue-500"
      }
      value={text()}
      onInput={handleInput}
      onBlur={handleBlur}
      placeholder={props.placeholder}
    />
  );
}

function ColorPicker(props: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onCleanup(() =>
    document.removeEventListener("mousedown", handleClickOutside),
  );

  return (
    <div class="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        class="w-7 h-7 rounded border border-slate-300 p-0.5 bg-white shadow-sm flex items-center justify-center hover:scale-105 transition"
        onClick={() => setIsOpen(!isOpen())}
      >
        <span
          class="w-full h-full rounded-sm"
          style={{ "background-color": props.color }}
        />
      </button>

      <Show when={isOpen()}>
        <div class="absolute left-0 top-9 z-50 bg-white border border-slate-200 rounded-lg p-3 shadow-xl w-48 space-y-2.5">
          <div class="text-[11px] font-bold text-slate-600">
            プリセットカラー
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            <For each={PRESET_COLORS}>
              {(c: string) => (
                <button
                  type="button"
                  class="w-8 h-8 rounded border border-slate-200 flex items-center justify-center hover:scale-110 transition"
                  style={{ "background-color": c }}
                  onClick={() => {
                    props.onChange(c);
                    setIsOpen(false);
                  }}
                >
                  <Show when={props.color.toLowerCase() === c.toLowerCase()}>
                    <Check class="w-4 h-4 text-white drop-shadow" />
                  </Show>
                </button>
              )}
            </For>
          </div>

          <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
            <input
              type="color"
              class="w-6 h-6 border-0 bg-transparent cursor-pointer p-0"
              value={props.color}
              onInput={(e) => props.onChange(e.currentTarget.value)}
            />
            <input
              type="text"
              class="flex-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono uppercase outline-none"
              value={props.color}
              onInput={(e) => props.onChange(e.currentTarget.value)}
            />
          </div>
        </div>
      </Show>
    </div>
  );
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
      showCrossBorder: false,
    },
  ]);

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

  createEffect(() => {
    if (!autoSaveEnabled()) return;
    localStorage.setItem("tab2plot_graph_state", JSON.stringify(graph()));
    localStorage.setItem("tab2plot_series_list", JSON.stringify(seriesList()));
    localStorage.setItem("tab2plot_raw_text", rawText());
    localStorage.setItem("tab2plot_batch_tasks", JSON.stringify(batchTasks()));
  });

  const handleResetNew = () => {
    if (!confirm("現在の設定とデータを初期化して新規作成しますか？")) return;
    setGraph({ ...defaultGraphState });
    setRawText(initialTableText);
    handleParseRawText();
    setStatusMessage("新規作成しました");
  };

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
      legend_margin: g.legendMargin,
      legend_area_size: g.legendAreaSize,
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
      show_cross_border: g.showCrossBorder,
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

  let timer: number | undefined;
  createEffect(() => {
    graph();
    seriesList();
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      triggerPreview();
    }, 250);
  });

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
              : PRESET_COLORS[idx % PRESET_COLORS.length],
          useSecondary: existing ? existing.useSecondary : p.use_secondary,
        };
      });

      setSeriesList(nextList);
      autoScaleRange(nextList);
      setStatusMessage(`${nextList.length} 系列を読み込みました`);
    } catch (err) {
      setStatusMessage(`パースエラー: ${err}`);
    }
  }

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
      setStatusMessage(`PNG 保存成功: ${selected}`);
    } catch (err) {
      setStatusMessage(`保存失敗: ${err}`);
    }
  }

  async function handleSaveSingleSvg() {
    const selected = await save({
      filters: [{ name: "SVG Vector Image", extensions: ["svg"] }],
      defaultPath: "graph.svg",
    });
    if (!selected) return;

    try {
      const g = graph();
      await invoke("save_graph_svg", {
        config: buildPayloadConfig(),
        seriesList: buildPayloadSeries(),
        width: g.canvasWidth,
        height: g.canvasHeight,
        filePath: selected,
      });
      setStatusMessage(`SVG 保存成功: ${selected}`);
    } catch (err) {
      setStatusMessage(`保存失敗: ${err}`);
    }
  }

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
        showCrossBorder: graph().showCrossBorder,
      },
    ]);
  };

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
            show_cross_border: t.showCrossBorder,
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
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
            onClick={handleSaveSingleSvg}
            title="ベクター画像形式で保存"
          >
            <FileCode class="w-3.5 h-3.5" />
            SVG 保存
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

              {/* 系列スタイル一覧 */}
              <div class="space-y-3">
                <div class="flex justify-between items-center px-1">
                  <h3 class="text-xs font-bold text-slate-800">
                    系列スタイル設定 ({seriesList().length} 系列)
                  </h3>
                </div>

                <Index each={seriesList()}>
                  {(item, idx) => (
                    <div class="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2.5">
                      <div class="flex items-center gap-2">
                        <ColorPicker
                          color={item().color}
                          onChange={(newColor) =>
                            setSeriesList((list) =>
                              list.map((s, i) =>
                                i === idx ? { ...s, color: newColor } : s,
                              ),
                            )
                          }
                        />
                        <input
                          type="text"
                          class="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                          value={item().label}
                          onInput={(e) =>
                            setSeriesList((list) =>
                              list.map((s, i) =>
                                i === idx
                                  ? { ...s, label: e.currentTarget.value }
                                  : s,
                              ),
                            )
                          }
                        />
                        <label class="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer ml-2">
                          <input
                            type="checkbox"
                            class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={item().useSecondary}
                            onChange={(e) =>
                              setSeriesList((list) =>
                                list.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        useSecondary: e.currentTarget.checked,
                                      }
                                    : s,
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
                            value={item().lineStyle}
                            onChange={(e) =>
                              setSeriesList((list) =>
                                list.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        lineStyle: e.currentTarget
                                          .value as LineStyleType,
                                      }
                                    : s,
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
                          <NumberInput
                            value={item().lineWidth}
                            onValueChange={(val) =>
                              setSeriesList((list) =>
                                list.map((s, i) =>
                                  i === idx ? { ...s, lineWidth: val || 1 } : s,
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
                            value={item().markerType}
                            onChange={(e) =>
                              setSeriesList((list) =>
                                list.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        markerType: e.currentTarget
                                          .value as MarkerType,
                                      }
                                    : s,
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
                          <NumberInput
                            value={item().markerSize}
                            onValueChange={(val) =>
                              setSeriesList((list) =>
                                list.map((s, i) =>
                                  i === idx
                                    ? { ...s, markerSize: val || 0 }
                                    : s,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </Index>
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
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                    <NumberInput
                      value={graph().xRangeStart}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, xRangeStart: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">終了</span>
                    <NumberInput
                      value={graph().xRangeEnd}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, xRangeEnd: val }))
                      }
                    />
                  </label>
                </div>

                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">スケール</span>
                    <select
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                    <NumberInput
                      value={graph().xMinorGridInterval}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, xMinorGridInterval: val }))
                      }
                    />
                  </label>
                </div>

                <Show when={graph().xTickMode === "Interval"}>
                  <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        ステップ間隔 (Base)
                      </span>
                      <NumberInput
                        value={graph().xIntervalBase}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, xIntervalBase: val || 1 }))
                        }
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        オフセット (Offset)
                      </span>
                      <NumberInput
                        value={graph().xIntervalOffset}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, xIntervalOffset: val }))
                        }
                      />
                    </label>
                  </div>
                </Show>

                <Show when={graph().xTickMode === "Explicit"}>
                  <div class="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        目盛り値リスト (カンマ区切り)
                      </span>
                      <input
                        type="text"
                        class="bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none"
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
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                    <NumberInput
                      value={graph().yRangeStart}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, yRangeStart: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">終了</span>
                    <NumberInput
                      value={graph().yRangeEnd}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, yRangeEnd: val }))
                      }
                    />
                  </label>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">スケール</span>
                    <select
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                    <NumberInput
                      value={graph().yMinorGridInterval}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, yMinorGridInterval: val }))
                      }
                    />
                  </label>
                </div>

                <Show when={graph().yTickMode === "Interval"}>
                  <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        ステップ間隔 (Base)
                      </span>
                      <NumberInput
                        value={graph().yIntervalBase}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, yIntervalBase: val || 1 }))
                        }
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        オフセット (Offset)
                      </span>
                      <NumberInput
                        value={graph().yIntervalOffset}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, yIntervalOffset: val }))
                        }
                      />
                    </label>
                  </div>
                </Show>

                <Show when={graph().yTickMode === "Explicit"}>
                  <div class="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        目盛り値リスト (カンマ区切り)
                      </span>
                      <input
                        type="text"
                        class="bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                        value={graph().yExplicitTicks}
                        onInput={(e) =>
                          setGraph((g) => ({
                            ...g,
                            yExplicitTicks: e.currentTarget.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </Show>
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
                      class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                    <NumberInput
                      value={graph().y2RangeStart}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, y2RangeStart: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">終了</span>
                    <NumberInput
                      value={graph().y2RangeEnd}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, y2RangeEnd: val }))
                      }
                    />
                  </label>
                </div>
              </div>
            </Show>

            {/* 3. 余白 & スタイル */}
            <Show when={activeTab() === "layout"}>
              {/* 解像度 & フォント */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  解像度 & 基本フォント
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">画像幅 (px)</span>
                    <NumberInput
                      value={graph().canvasWidth}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, canvasWidth: val || 1600 }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      画像高さ (px)
                    </span>
                    <NumberInput
                      value={graph().canvasHeight}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, canvasHeight: val || 1200 }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      基本フォントサイズ (pt)
                    </span>
                    <NumberInput
                      value={graph().baseFontSize}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, baseFontSize: val || 36 }))
                      }
                    />
                  </label>
                </div>
              </div>

              {/* 余白・軸エリア */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  余白・エリア幅 (px)
                </h3>
                <div class="grid grid-cols-4 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      外周余白 (margin)
                    </span>
                    <NumberInput
                      value={graph().margin}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, margin: val || 60 }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      X軸エリア (下部)
                    </span>
                    <NumberInput
                      value={graph().xLabelArea}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, xLabelArea: val || 160 }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      Y軸エリア (左部)
                    </span>
                    <NumberInput
                      value={graph().yLabelArea}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, yLabelArea: val || 180 }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      右側余白 / Y2
                    </span>
                    <NumberInput
                      value={graph().rightMargin}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, rightMargin: val || 140 }))
                      }
                    />
                  </label>
                </div>
              </div>

              {/* 目盛り線 & 数値フォーマット */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  目盛り線 (Ticks) & 数値フォーマット
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      目盛り線の太さ (px)
                    </span>
                    <NumberInput
                      value={graph().tickWidth}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, tickWidth: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      X軸目盛りの長さ (px)
                    </span>
                    <NumberInput
                      value={graph().xTickLength}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, xTickLength: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      Y軸目盛りの長さ (px)
                    </span>
                    <NumberInput
                      value={graph().yTickLength}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, yTickLength: val }))
                      }
                    />
                  </label>
                </div>

                <div class="grid grid-cols-3 gap-2.5 pt-1">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      X軸の小数点桁数
                    </span>
                    <NumberInput
                      value={graph().xFormatFixed}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, xFormatFixed: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      Y軸の小数点桁数
                    </span>
                    <NumberInput
                      value={graph().yFormatFixed}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, yFormatFixed: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      Y2軸の小数点桁数
                    </span>
                    <NumberInput
                      value={graph().y2FormatFixed}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, y2FormatFixed: val }))
                      }
                    />
                  </label>
                </div>
              </div>

              {/* 枠線・グリッド & 十字軸 */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold text-slate-900 border-b pb-1.5">
                  枠線 & グリッド線
                </h3>
                <div class="grid grid-cols-3 gap-2.5">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      外枠の太さ (px)
                    </span>
                    <NumberInput
                      value={graph().axisWidth}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, axisWidth: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      グリッド線の太さ (px)
                    </span>
                    <NumberInput
                      value={graph().minorGridWidth}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, minorGridWidth: val }))
                      }
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] text-slate-500">
                      グリッド濃さ (0.0〜1.0)
                    </span>
                    <NumberInput
                      value={graph().gridOpacity}
                      onValueChange={(val) =>
                        setGraph((g) => ({ ...g, gridOpacity: val }))
                      }
                    />
                  </label>
                </div>

                <div class="flex items-center gap-6 pt-1">
                  <label class="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={graph().useCrossAxes}
                      onChange={(e) =>
                        setGraph((g) => ({
                          ...g,
                          useCrossAxes: e.currentTarget.checked,
                        }))
                      }
                    />
                    十字軸モード（原点 (0,0) で交差）
                  </label>
                  <Show when={graph().useCrossAxes}>
                    <label class="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={graph().showCrossBorder}
                        onChange={(e) =>
                          setGraph((g) => ({
                            ...g,
                            showCrossBorder: e.currentTarget.checked,
                          }))
                        }
                      />
                      外枠線も併せて表示
                    </label>
                  </Show>
                </div>
              </div>

              {/* 凡例スタイル詳細 */}
              <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                <div class="flex items-center justify-between border-b pb-1.5">
                  <h3 class="text-xs font-bold text-slate-900">
                    凡例 (Legend) の詳細スタイル
                  </h3>
                  <label class="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                </div>

                <Show when={graph().showLegend}>
                  <div class="grid grid-cols-3 gap-2.5">
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">配置位置</span>
                      <select
                        class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:bg-white"
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
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        枠線の太さ (px)
                      </span>
                      <NumberInput
                        value={graph().legendBorderWidth}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, legendBorderWidth: val }))
                        }
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        背景の不透明度 (0.0〜1.0)
                      </span>
                      <NumberInput
                        value={graph().legendBackgroundOpacity}
                        onValueChange={(val) =>
                          setGraph((g) => ({
                            ...g,
                            legendBackgroundOpacity: val,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div class="grid grid-cols-2 gap-2.5 pt-1">
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        凡例マージン (px)
                      </span>
                      <NumberInput
                        value={graph().legendMargin}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, legendMargin: val }))
                        }
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span class="text-[11px] text-slate-500">
                        凡例行間/エリアサイズ (px)
                      </span>
                      <NumberInput
                        value={graph().legendAreaSize}
                        onValueChange={(val) =>
                          setGraph((g) => ({ ...g, legendAreaSize: val }))
                        }
                      />
                    </label>
                  </div>
                </Show>
              </div>
            </Show>

            {/* 4. バッチ設定 */}
            <Show when={activeTab() === "batch"}>
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <div>
                    <h3 class="text-xs font-bold text-slate-800">
                      バッチ一括実行ビルダー
                    </h3>
                    <p class="text-[11px] text-slate-500">
                      各タスクの個別差分を設定
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

                <div class="space-y-3">
                  <Index each={batchTasks()}>
                    {(task, idx) => (
                      <div class="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
                        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                          <button
                            class="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-blue-600 transition"
                            onClick={() =>
                              setBatchTasks((tasks) =>
                                tasks.map((t, i) =>
                                  i === idx
                                    ? { ...t, expanded: !t.expanded }
                                    : t,
                                ),
                              )
                            }
                          >
                            {task().expanded ? (
                              <ChevronDown class="w-4 h-4" />
                            ) : (
                              <ChevronRight class="w-4 h-4" />
                            )}
                            タスク #{idx + 1}
                            <span class="text-[11px] font-normal text-slate-500">
                              ({task().input || "ファイル未選択"})
                            </span>
                          </button>
                          <button
                            class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            onClick={() =>
                              setBatchTasks((tasks) =>
                                tasks.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>

                        <div class="grid grid-cols-2 gap-2.5">
                          <div class="flex flex-col gap-1">
                            <span class="text-[11px] text-slate-500">
                              入力ファイル
                            </span>
                            <div class="flex gap-1">
                              <input
                                type="text"
                                placeholder="samples/wave.tsv"
                                class="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                value={task().input}
                                onInput={(e) =>
                                  setBatchTasks((tasks) =>
                                    tasks.map((t, i) =>
                                      i === idx
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
                                        i === idx ? { ...t, input: sel } : t,
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
                              出力先 (省略で同名画像)
                            </span>
                            <input
                              type="text"
                              placeholder="dist/output.png または .svg"
                              class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                              value={task().output}
                              onInput={(e) =>
                                setBatchTasks((tasks) =>
                                  tasks.map((t, i) =>
                                    i === idx
                                      ? { ...t, output: e.currentTarget.value }
                                      : t,
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>

                        <Show when={task().expanded}>
                          <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 pt-2">
                            <div class="flex items-center justify-between border-b pb-2">
                              <label class="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  class="rounded border-slate-300 text-blue-600"
                                  checked={task().overrideSettings}
                                  onChange={(e) =>
                                    setBatchTasks((tasks) =>
                                      tasks.map((t, i) =>
                                        i === idx
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
                                このタスクの個別設定を有効化
                              </label>

                              <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={task().overrideSize}
                                  onChange={(e) =>
                                    setBatchTasks((tasks) =>
                                      tasks.map((t, i) =>
                                        i === idx
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

                            <Show when={task().overrideSettings}>
                              <div class="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                                <span class="text-xs font-bold text-slate-700">
                                  X 軸設定
                                </span>
                                <div class="grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    placeholder="タイトル"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task().xDesc}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx
                                            ? {
                                                ...t,
                                                xDesc: e.currentTarget.value,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <NumberInput
                                    value={task().xRangeStart}
                                    onValueChange={(val) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx
                                            ? { ...t, xRangeStart: val }
                                            : t,
                                        ),
                                      )
                                    }
                                    placeholder="開始"
                                  />
                                  <NumberInput
                                    value={task().xRangeEnd}
                                    onValueChange={(val) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx
                                            ? { ...t, xRangeEnd: val }
                                            : t,
                                        ),
                                      )
                                    }
                                    placeholder="終了"
                                  />
                                </div>
                              </div>

                              <div class="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                                <span class="text-xs font-bold text-slate-700">
                                  Y 軸設定
                                </span>
                                <div class="grid grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    placeholder="タイトル"
                                    class="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                                    value={task().yDesc}
                                    onInput={(e) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx
                                            ? {
                                                ...t,
                                                yDesc: e.currentTarget.value,
                                              }
                                            : t,
                                        ),
                                      )
                                    }
                                  />
                                  <NumberInput
                                    value={task().yRangeStart}
                                    onValueChange={(val) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx
                                            ? { ...t, yRangeStart: val }
                                            : t,
                                        ),
                                      )
                                    }
                                    placeholder="開始"
                                  />
                                  <NumberInput
                                    value={task().yRangeEnd}
                                    onValueChange={(val) =>
                                      setBatchTasks((tasks) =>
                                        tasks.map((t, i) =>
                                          i === idx
                                            ? { ...t, yRangeEnd: val }
                                            : t,
                                        ),
                                      )
                                    }
                                    placeholder="終了"
                                  />
                                </div>
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Index>
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
