use clap::Parser;
use std::path::PathBuf;
use tab2plot::wrap::{execute_batch, render_from_files};

#[derive(Parser, Debug)]
#[command(
    name = "tab2plot",
    about = "TSV/CSVから高精度な学術・技術グラフを生成するツール"
)]
struct Cli {
    /// 入力データファイル（複数指定・ワイルドカード可能）
    #[arg(short, long, num_args = 1..)]
    input: Vec<PathBuf>,

    /// 出力先（単一ファイルパス、または複数処理時はディレクトリパス）
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// グラフ設定JSONファイル（単一処理または全ファイル共通設定）
    #[arg(short, long)]
    config: Option<PathBuf>,

    /// 一括実行用のバッチ設定JSONファイル
    #[arg(short, long)]
    batch: Option<PathBuf>,

    #[arg(long, default_value_t = 1920)]
    width: u32,

    #[arg(long, default_value_t = 1440)]
    height: u32,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    // 1. バッチJSON指定モード
    if let Some(batch_path) = cli.batch {
        println!("Running batch job from: {:?}", batch_path);
        execute_batch(batch_path)?;
        println!("All batch jobs finished successfully.");
        return Ok(());
    }

    if cli.input.is_empty() {
        eprintln!(
            "Error: 入力ファイル (-i/--input) またはバッチ設定 (-b/--batch) を指定してください。"
        );
        std::process::exit(1);
    }

    // 2. 単一ファイル処理
    if cli.input.len() == 1 {
        let in_path = &cli.input[0];
        let out_path = cli.output.unwrap_or_else(|| in_path.with_extension("png"));

        render_from_files(
            in_path,
            &out_path,
            cli.config.as_ref(),
            cli.width,
            cli.height,
        )?;
        println!("Graph saved: {:?}", out_path);
        return Ok(());
    }

    // 3. 複数ファイル一括処理 (CLI 引数指定)
    let out_dir = cli.output.unwrap_or_else(|| PathBuf::from("./dist"));
    for (i, in_path) in cli.input.iter().enumerate() {
        let file_stem = in_path.file_stem().unwrap_or_default();
        let out_path = out_dir.join(format!("{}.png", file_stem.to_string_lossy()));

        render_from_files(
            in_path,
            &out_path,
            cli.config.as_ref(),
            cli.width,
            cli.height,
        )?;
        println!(
            "[{}/{}] Graph saved: {:?}",
            i + 1,
            cli.input.len(),
            out_path
        );
    }

    Ok(())
}
