import { createSignal, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import "./App.css";

interface Series {
  label: string;
  points: [number, number][];
  marker_type: string;
  marker_size: number;
  draw_line: boolean;
  line_width: number;
  color: [number, number, number];
}

function App() {
  // グラフ基本設定
  const [xDesc, setXDesc] = createSignal("距離 [cm]");
  const [yDesc, setYDesc] = createSignal("電圧 [V]");
  const [savePath, setSavePath] = createSignal("");
  const [graphImg, setGraphImg] = createSignal("");
  const [statusMsg, setStatusMsg] = createSignal("");

  // 系列データの管理 (初期値として1系列用意)
  const [seriesList, setSeriesList] = createSignal<Series[]>([
    {
      label: "1回目",
      points: [
        [0.0, 3.05],
        [0.5, 2.25],
      ],
      marker_type: "Cross",
      marker_size: 15,
      draw_line: false,
      line_width: 0,
      color: [0, 0, 0],
    },
  ]);

  // CSVからポイントを読み込む
  async function handleLoadCSV(seriesIndex: number) {
    const selected = await open({
      filters: [{ name: "CSV File", extensions: ["csv"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    try {
      const importedPoints = await invoke<[number, number][]>(
        "load_points_from_csv",
        { filePath: selected },
      );

      // 対象の系列のpointsを更新
      const updated = [...seriesList()];
      updated[seriesIndex].points = importedPoints;
      setSeriesList(updated);
      setStatusMsg(
        `CSVから ${importedPoints.length} 件のデータを読み込みました。`,
      );
    } catch (e) {
      setStatusMsg(`CSV読み込みエラー: ${e}`);
    }
  }

  // テーブルに手動で1行追加
  function addRow(seriesIndex: number) {
    const updated = [...seriesList()];
    updated[seriesIndex].points.push([0.0, 0.0]);
    setSeriesList(updated);
  }

  // テーブルの値を直接書き換え
  function updatePoint(
    seriesIndex: number,
    pointIndex: number,
    coord: 0 | 1,
    value: number,
  ) {
    const updated = [...seriesList()];
    updated[seriesIndex].points[pointIndex][coord] = value;
    setSeriesList(updated);
  }

  // グラフ生成処理
  async function handleGenerate() {
    if (!savePath()) return setStatusMsg("先に保存場所を指定してください。");

    const config = {
      x_desc: xDesc(),
      y_desc: yDesc(),
      x_range: { start: 0.0, end: 3.5 },
      y_range: { start: 2.0, end: 3.5 },
      x_labels: 8,
      y_labels: 4,
      x_ticks: [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
      y_ticks: [2.0, 2.5, 3.0, 3.5],
      x_tick_length: 0.045,
      y_tick_length: 0.105,
      x_format_fixed: 1,
      y_format_fixed: 1,
      show_legend: true,
    };

    try {
      setStatusMsg("生成中...");
      const imgDataUrl = await invoke<string>("generate_and_save_graph", {
        config,
        seriesList: seriesList(),
        savePath: savePath(),
      });
      setGraphImg(imgDataUrl);
      setStatusMsg("グラフを保存しました！");
    } catch (error) {
      setStatusMsg(`エラー: ${error}`);
    }
  }

  return (
    <main class="app-container">
      <header>
        <h1>tab2plot ワークスペース</h1>
      </header>

      <div class="workspace">
        {/* 左側：設定・出力ペイン */}
        <div class="panel settings-panel">
          <h3>グラフ共通設定</h3>
          <input
            type="text"
            value={xDesc()}
            onInput={(e) => setXDesc(e.currentTarget.value)}
            placeholder="X軸ラベル"
          />
          <input
            type="text"
            value={yDesc()}
            onInput={(e) => setYDesc(e.currentTarget.value)}
            placeholder="Y軸ラベル"
          />

          <hr />

          <button
            onClick={async () => {
              const path = await save({
                filters: [{ name: "PNG", extensions: ["png"] }],
              });
              if (path) setSavePath(path);
            }}
          >
            保存先を選択
          </button>
          <p class="path-text">{savePath() || "未指定"}</p>

          <button class="btn-primary" onClick={handleGenerate}>
            グラフを出力
          </button>
          <p class="status">{statusMsg()}</p>
        </div>

        {/* 右側：データ編集ペイン */}
        <div class="panel data-panel">
          <h3>系列データ編集</h3>
          <For each={seriesList()}>
            {(series, sIdx) => (
              <div class="series-box">
                <div class="series-header">
                  <input
                    type="text"
                    value={series.label}
                    onInput={(e) => {
                      const u = [...seriesList()];
                      u[sIdx()].label = e.currentTarget.value;
                      setSeriesList(u);
                    }}
                  />
                  <button onClick={() => handleLoadCSV(sIdx())}>
                    CSVからインポート
                  </button>
                </div>

                {/* 直接書き込み用データテーブル */}
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>X</th>
                      <th>Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={series.points}>
                      {(point, pIdx) => (
                        <tr>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={point[0]}
                              onInput={(e) =>
                                updatePoint(
                                  sIdx(),
                                  pIdx(),
                                  0,
                                  parseFloat(e.currentTarget.value) || 0,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={point[1]}
                              onInput={(e) =>
                                updatePoint(
                                  sIdx(),
                                  pIdx(),
                                  1,
                                  parseFloat(e.currentTarget.value) || 0,
                                )
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
                <button class="btn-small" onClick={() => addRow(sIdx())}>
                  + 行を追加
                </button>
              </div>
            )}
          </For>
        </div>
      </div>

      {graphImg() && (
        <div class="preview-area">
          <h3>プレビュー</h3>
          <img src={graphImg()} alt="Preview" />
        </div>
      )}
    </main>
  );
}

export default App;
