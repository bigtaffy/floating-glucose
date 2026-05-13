# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-05-13

### Fixed

- **浮動視窗大小不會跟著字體放大** — 之前固定 200×90，字體設到 50 以上副資訊（`+7 mg/dL`、`1 分鐘前`）被遮住。現在視窗會依照實際渲染內容自動撐開，右邊緣保持原位（拖到角落不會跑掉）
- **小字隨大字消失** — 同上根本原因解決

### Changed

- 浮動視窗背景圓角 8 → 10px、padding 加寬，視覺更舒適
- 加 `min-width: 120px` 避免極小數值時視窗縮太小不好點

## [1.0.1] - 2026-05-13

### Added

- **自動更新** — App 啟動 30 秒後自動檢查 GitHub Release 上的新版，並每 6 小時複查一次。新版自動背景下載，下載完成後彈出對話框詢問「立即重啟」或「稍後再說」
- **托盤新增「檢查程式更新」選項** — 手動觸發檢查並顯示結果
- **托盤新增版本顯示** — 選單列出當前版本（v1.0.1）
- **更新流程多國語言** — 4 種語言（繁中／簡中／英文／日文）的更新對話框與通知文案
- **package.json metadata** — homepage、repository 欄位，appId 與 publish 設定

### Notes

> v1.0.0 → v1.0.1 是首次帶有自動更新功能的版本，v1.0.0 已安裝的使用者**需手動下載 v1.0.1 一次**，之後 v1.0.1 → v1.0.2 起就會自動更新。

## [1.0.0] - 2026-05-13

### Added — 第一個正式版

- **跨平台支援** — macOS（Intel + Apple Silicon）與 Windows x64
- **浮動桌面視窗** — 透明、永遠最上層、可滑鼠拖曳，位置記憶
- **macOS 選單列顯示** — 血糖值與趨勢箭頭直接顯示在系統選單列
- **三種顯示模式可組合**：桌面浮動視窗、選單列、隱藏 Dock 圖示（macOS）
- **多國語言介面** — 繁體中文、簡體中文、English、日本語，依系統語言自動偵測
- **Nightscout 整合** — 透過 `/api/v1/entries.json` 讀取最新血糖值，支援 token 與 api-secret (SHA-1) 兩種認證
- **顏色警示** — In-range / High / Urgent-high / Low / Urgent-low / Stale 六種狀態
- **趨勢箭頭** — 7 種方向（DoubleUp / SingleUp / FortyFiveUp / Flat / FortyFiveDown / SingleDown / DoubleDown）
- **資料過期偵測** — 預設 15 分鐘警告、30 分鐘嚴重
- **設定畫面** — 包含 Test connection 連線測試、警報閾值自訂、字體大小調整、更新頻率調整
- **單位支援** — mg/dL（台灣 / 美國 / 日本）與 mmol/L（歐洲 / 加拿大 / 澳洲）
- **托盤選單** — Refresh / Settings / Quit
- **應用程式圖示** — macOS Big Sur 風格圓角，全套尺寸 16 → 1024
- **隱私** — 完全不收集資料、無 telemetry、設定僅存本機
- **醫療免責聲明** — README 與 LICENSE 內均明確說明非醫療器材
- **GitHub Actions CI** — push 自動跨平台打包，tag 自動發布 Release

### Acknowledgments

Inspired by [FloatingGlucose](https://github.com/bjornnyhus/FloatingGlucose) by Bjorn Inge Vikhammer (Windows-only original).

[Unreleased]: https://github.com/bigtaffy/floating-glucose/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.2
[1.0.1]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.1
[1.0.0]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.0
