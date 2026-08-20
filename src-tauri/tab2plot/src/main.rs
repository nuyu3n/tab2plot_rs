use clap::Parser;
use std::path::PathBuf;
use tab2plot::wrap::{execute_batch, render_from_files};

#[derive(Parser, Debug)]
#[command(
    name = "tab2plot",
    about = "TSV/CSVから高精度な学術・技術グラフを生成するツール",
    version
)]
struct Cli {
    /// 入力データファイル（複数指定・ワイルドカード可能）
    #[arg(short, long, num_args = 1.., conflicts_with = "batch")]
    input: Vec<PathBuf>,

    /// 出力先（単一ファイルパス、または複数処理時はディレクトリパス）
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// グラフ設定JSONファイル（単一処理または全ファイル共通設定）
    #[arg(short, long, conflicts_with = "batch")]
    config: Option<PathBuf>,

    /// 一括実行用のバッチ設定JSONファイル
    #[arg(short, long, conflicts_with_all = ["input", "config"])]
    batch: Option<PathBuf>,

    /// 出力画像の幅 (px)
    #[arg(long, default_value_t = 1920)]
    width: u32,

    /// 出力画像の高さ (px)
    #[arg(long, default_value_t = 1440)]
    height: u32,

    /// SVG形式で出力（未指定時はPNG）
    #[arg(long)]
    svg: bool,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    if cli.width == 0 || cli.height == 0 {
        return Err("幅(--width)および高さ(--height)は1px以上を指定してください。".into());
    }

    // 1. バッチJSON指定モード
    if let Some(batch_path) = cli.batch {
        println!("Running batch job from: {:?}", batch_path);
        execute_batch(&batch_path, Some(cli.width), Some(cli.height))?;
        println!("All batch jobs finished successfully.");
        return Ok(());
    }

    if cli.input.is_empty() {
        return Err(
            "入力ファイル (-i/--input) またはバッチ設定 (-b/--batch) を指定してください。".into(),
        );
    }

    let default_ext = if cli.svg { "svg" } else { "png" };

    // 2. 単一ファイル処理
    if cli.input.len() == 1 {
        let in_path = &cli.input[0];
        let out_path = match cli.output {
            Some(ref out) => {
                if out.is_dir() || out.extension().is_none() {
                    let file_stem = in_path.file_stem().unwrap_or_default();
                    out.join(format!("{}.{}", file_stem.to_string_lossy(), default_ext))
                } else {
                    out.clone()
                }
            }
            None => in_path.with_extension(default_ext),
        };

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

    // 3. 複数ファイル一括処理
    let out_dir = match cli.output {
        Some(ref out) => {
            if let Some(ext) = out.extension() {
                if ext.eq_ignore_ascii_case("png") || ext.eq_ignore_ascii_case("svg") {
                    return Err("複数ファイル入力時、--output (-o) に単一画像ファイル名は指定できません。出力先ディレクトリを指定してください。".into());
                }
            }
            out.clone()
        }
        None => PathBuf::from("./dist"),
    };

    for (i, in_path) in cli.input.iter().enumerate() {
        let file_stem = in_path.file_stem().unwrap_or_default();
        let out_path = out_dir.join(format!("{}.{}", file_stem.to_string_lossy(), default_ext));

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
