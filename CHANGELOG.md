# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-13

### Added — Tier 1 三大功能

- **🔔 聲音警報** — 進入緊急高/低血糖時自動播放警報音
  - urgent-low：4 聲較低頻 440 Hz（更急促）
  - urgent-high：3 聲較高頻 880 Hz
  - 用 Web Audio API 即時合成，無需音檔；只在「進入」緊急狀態時觸發一次，不會重複噪音轟炸
  - 設定畫面可開關（預設開）

- **📈 趨勢圖視窗** — 點擊浮動視窗的血糖數字 或 托盤選單「顯示趨勢圖」開啟
  - 預設顯示過去 4 小時（可在設定改 1–24 小時）
  - SVG 折線圖、依血糖等級著色
  - 4 條閾值參考線（urgent-high / high / low / urgent-low）+ in-range 綠色帶
  - 統計：TIR (Time In Range) %、平均、最高、最低
  - 每分鐘自動刷新

- **📡 CGM 斷線通知** — 資料超過設定門檻沒更新時，跳出 OS 系統通知
  - 偵測「從正常進入失聯」的狀態轉換，不會重複轟炸
  - 緊急高/低血糖也同步發 OS 系統通知（除聲音外的視覺提醒）
  - 設定畫面可開關（預設開）

### Changed

- 托盤選單新增「顯示趨勢圖」項目
- 浮動視窗的血糖數字現在是可點擊元素（hover 變手指游標）

### Technical

- `main.js`：新增 `previousStatus` 狀態追蹤、`handleStateTransition()`、`openTrend()`、`fetch-trend` IPC handler
- `renderer/trend.html`：純 SVG 渲染，無第三方圖表庫依賴
- 4 種語言新增 alert / trend / settings.alerts* 字串

## [1.0.4] - 2026-05-13

### Fixed

- **macOS 自動更新失敗** — 錯誤訊息「無法檢查更新：ZIP file not provided」。原因是 electron-updater 在 macOS 上需要 `.zip` 檔做 in-place 更新（無法用 `.dmg`），而我們之前只打包 `.dmg`。新增 `zip` 為 macOS build target，CI 一併上傳到 Release，latest-mac.yml 從此包含 `.zip` 連結，自動更新可正常運作

### Notes

> v1.0.3 macOS 使用者**這次需要手動下載 v1.0.4 一次**（因為 v1.0.3 release 沒有 zip）。從 v1.0.4 起 macOS 自動更新將正常運作。
> Windows 使用者不受影響，因為 Windows 用的是 NSIS installer 不需要 zip。

## [1.0.3] - 2026-05-13

### Changed

- **浮動視窗有資料時改為完全透明** — 之前 macOS 上半透明深色背景襯亮桌布變成明顯的黑灰小方塊，看起來像實心方框。改為「有資料 = 完全透明（純文字 + 強化 text-shadow）」「無資料 / 錯誤 / 未設定 = 顯示背景框」，恢復原版 FloatingGlucose 的純文字飄浮 UX，同時保留「找不到視窗」的安全網
- 強化 text-shadow（5px 模糊 + 3px 模糊 + 向下投影），確保透明狀態下文字在任何桌布顏色都清楚
- 錯誤狀態改用半透明紅色背景，視覺上更明確

### Added

- **完整移除工具** — `scripts/uninstall-windows.cmd` 與 `scripts/uninstall-mac.command`，給遇到 NSIS integrity check 失敗或找不到 App 的使用者用，雙擊執行可清除：程式、安裝資料夾、設定（含 NS 密碼）、更新快取、捷徑、註冊表/偏好設定。README Q7 已加上下載連結
- README macOS 安裝步驟新增「已損毀」警告的 `xattr -cr` 解法說明

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

[Unreleased]: https://github.com/bigtaffy/floating-glucose/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.1.0
[1.0.4]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.4
[1.0.3]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.3
[1.0.2]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.2
[1.0.1]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.1
[1.0.0]: https://github.com/bigtaffy/floating-glucose/releases/tag/v1.0.0
