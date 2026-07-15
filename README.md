# tab2plot_rs

tab2plot_rs is a Tauri + SolidJS desktop app for editing graph settings, importing CSV data, previewing plots, and exporting PNG images through the Rust backend.

## What this app does

- Edit graph settings in the live editor and preview the result automatically.
- Import CSV files into a series and show the source rows in a raw table preview.
- Create multiple graph snapshots from the current settings and render them side by side.
- Export the current graph as PNG.

## Run locally

- Frontend build: `pnpm build`
- Rust check: `Set-Location src-tauri; cargo check`
- Tauri dev mode: `pnpm tauri dev`

## CSV workflow

- Use the CSV button inside a series card to import points.
- The app also keeps a preview of the source CSV rows so you can inspect the original data as-is.
- The backend accepts flexible CSV input and reports row-level parse errors when a row cannot be converted to numeric points.

## Multi-graph workflow

- Click the button to add the current settings to the saved graph gallery.
- Each saved graph card keeps its own canvas settings and preview image.
- Use the gallery controls to reload a snapshot into the editor, duplicate it, remove it, or render all saved graphs in one pass.

## Recommended IDE setup

- VS Code
- Tauri extension
- rust-analyzer
