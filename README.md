# 桌面血糖鐘 · FloatingGlucose

> 從 Nightscout 即時讀取血糖值，浮動顯示在桌面或 macOS 選單列上。
> 給糖友與照護者，**坐在電腦前工作時不用拿手機，眼角一瞥就知道現在血糖多少**。
>
> *Cross-platform desktop blood glucose widget for Nightscout users.*
> *Available on macOS and Windows · 繁中 / 简中 / English / 日本語.*

---

## ⚠️ 重要免責聲明（請務必先看）

本軟體**僅供資訊參考**，**不是醫療器材**，**不能用於診斷、治療或預防任何疾病**。

任何醫療決策（胰島素劑量、低血糖處理、運動強度、飲食調整等）**必須**以你的：
1. 實際 CGM 或血糖機讀值
2. 醫師、衛教師、營養師、CDE 的建議
3. 個人臨床狀況

為依據。**請不要**僅依本軟體顯示的數字做任何醫療判斷。

軟體可能因網路、CGM 上傳延遲、Nightscout 服務中斷、本機程式錯誤等原因顯示**錯誤、過舊或無法更新**的數值。**發生疑似低血糖請立即補糖並以你身邊的物理血糖儀為準。**

---

## ✨ 這個 App 是做什麼的？

如果你是 **第一型糖尿病（T1D）** 患者、**第二型糖尿病（T2D）** 患者，或是 T1D 兒童的家長，你大概已經習慣戴 CGM（連續血糖監測儀，例如歐態 / Libre / Dexcom / Medtronic），並用手機 App 看數值。

坐在電腦前工作或上課時，每 5 分鐘拿手機看一次很煩、也容易分心。**桌面血糖鐘**會把你的最新血糖值「永遠浮在桌面右上角」，或顯示在 macOS 選單列旁邊。**不用切換 App、不用拿手機、眼角一瞥即可知道**。

數值會隨高低自動變色：

| 顏色 | 含意 |
|---|---|
| 🟢 綠色 | 在你的目標範圍內 |
| 🟡 黃色 | 偏高或偏低（注意觀察） |
| 🔴 紅色 | 嚴重偏高或偏低（建議處理） |
| ⚪️ 灰色 | 資料太舊（預設超過 15 分鐘未更新） |

旁邊也會顯示**趨勢箭頭**（↑↗→↘↓），不只看到「現在多少」，也看到「正在往哪走」。

---

## 🩺 這個 App **不是**什麼

- ❌ **不是醫療器材**
- ❌ **不取代你的 CGM、指尖血糖機、或醫師**
- ❌ **不主動測血糖、不打針、不算劑量**
- ❌ **不發出緊急通報或叫救護車**
- ❌ **不上傳血糖到任何第三方**

它只做**一件事**：把 Nightscout 上已經存在的最新血糖值，畫在你電腦的桌面上。

---

## 📋 安裝前要準備什麼？

你必須先有 **Nightscout（簡稱 NS）站台**，並且你的 CGM 資料正在上傳到 NS。

### 如果你用 **歐態 CGM**

1. 打開歐態 App
2. 「**我的**」→「**小歐生態**」→「**Nightscout 開啟**」
3. 把你的 NS 網址與密碼填進去，存檔
4. 等約 5 分鐘，到電腦瀏覽器打開你的 NS 網址，**確認血糖值有上傳**
5. 把網址跟密碼記下來，等下要填進這個桌面 App

### 如果你用其他 CGM

請依各 CGM 的方式設定 Nightscout 上傳。常見組合：
- **Dexcom + xDrip+** → xDrip+ 設定 Cloud upload 到 NS
- **Libre + xDrip+ / Diabox** → 同上
- **Medtronic 700** → 透過 600-series-android-uploader

### 沒有 NS 站台怎麼辦？

Nightscout 是免費開源的雲端血糖紀錄系統。常見託管方式：
- **T1NS** — 台灣社群提供（中文支援）
- 自行用 Heroku / Northflank / Railway / Fly.io 等平台部署
- 詳見 [Nightscout 官網](https://nightscout.github.io/)

---

## 💾 安裝步驟

### macOS（10.15 Catalina 以上）

1. 到本專案的 [**Releases** 頁面](../../releases) 下載 `.dmg`
   - **M1 / M2 / M3 / M4 系列 Mac** → 選 `FloatingGlucose-x.x.x-arm64.dmg`
   - **Intel Mac**（2020 年以前的 Mac） → 選 `FloatingGlucose-x.x.x.dmg`
   - 不確定自己是哪一種？點左上角 蘋果圖示 → 「關於這台 Mac」，看「晶片」欄位。寫 Apple M 開頭就選 arm64。
2. 雙擊 `.dmg`，把 App 圖示拖到「應用程式」資料夾

3. 第一次打開可能會遇到**兩種**警告，依出現的訊息對應：

   **狀況 A — 跳「無法打開」**：
   > 無法打開「FloatingGlucose」，因為 Apple 無法檢查其中是否包含惡意軟體

   解法：在「應用程式」資料夾**右鍵點 FloatingGlucose → 開啟 → 仍要開啟**

   **狀況 B — 跳「已損毀」**：
   > 「FloatingGlucose」已損毀且無法打開。您應該將它移到「垃圾桶」。

   檔案沒壞，是 macOS 看到「未簽章 App 從網路下載」就會這樣警告。打開 Terminal（`Cmd + Space` 打「終端機」）貼這行 Enter：

   ```bash
   xattr -cr /Applications/FloatingGlucose.app
   ```

   跑完再雙擊就能正常開啟，且以後不會再跳這個警告。

4. 之後就可以正常雙擊開啟了

### Windows（10 / 11）

1. 到本專案的 [**Releases** 頁面](../../releases) 下載 `FloatingGlucose Setup x.x.x.exe`
2. 雙擊執行，Windows SmartScreen 會擋（藍色畫面）
3. 點「**其他資訊**」→ 出現「**仍要執行**」按鈕 → 點下去
4. 安裝精靈可勾選「在桌面建立捷徑」「開機自動啟動」（兩個都建議勾）

---

## ⚙️ 第一次設定

開啟 App 後設定畫面會**自動跳出**，需要填這些：

| 欄位 | 填什麼 | 範例 |
|---|---|---|
| Nightscout URL | 你的 NS 完整網址 | `https://09xxxxxx.t1ns.tw/` |
| Access Token | 你的 NS 密碼 / token | （照你 NS 設定的） |
| Units（單位） | 台灣選 `mg/dL`，歐洲 / 加拿大常用 `mmol/L` | `mg/dL` |
| Urgent High（緊急高） | 高到多少要紅色警示 | `200`（mg/dL） |
| High（偏高） | 高到多少要黃色警示 | `150` |
| Low（偏低） | 低到多少要黃色警示 | `85` |
| Urgent Low（緊急低） | 低到多少要紅色警示 | `68` |
| 介面語言 | 繁中 / 简中 / English / 日本語 | 系統自動偵測 |

> 💡 **警報閾值要依你的醫師建議調整**，預設值只是一般成人 T1D 的概略值，不適用於所有人（尤其孕婦、兒童、長者）。

按 **Test connection** 確認連線成功，再按 **Verify and save**。

血糖值會出現在桌面右上角的小視窗，你可以**用滑鼠拖到任何位置**，下次開機會記得位置。macOS 同時會在系統選單列右側顯示數值。

---

## 🎨 顯示模式（macOS 限定組合）

設定畫面的「Display」區塊有三個勾選項，可自由組合：

- **顯示桌面浮動視窗** — 那個浮在所有視窗最上層的小數字
- **在選單列顯示血糖值** — 數字 + 箭頭直接出現在 macOS 系統選單列右側
- **隱藏 Dock 圖示** — 想要更低調？變成純選單列 App

常見組合：

| 想要什麼 | 設定 |
|---|---|
| 最顯眼（預設） | ☑ 浮動視窗 + ☑ 選單列 + ☐ 隱藏 Dock |
| 工作不被干擾 | ☐ 浮動視窗 + ☑ 選單列 + ☑ 隱藏 Dock（只剩選單列數字） |
| 看影片時 | ☑ 浮動視窗（會浮在影片上）+ 其他隨意 |

Windows 上預設只有桌面浮動視窗 + 系統匣圖示（這是 Windows 的設計限制，選單列數值是 macOS 獨有）。

---

## 🔒 隱私聲明

- **本 App 完全不收集你的任何資料**，沒有分析、追蹤、廣告、Telemetry。
- 你的 NS 網址與密碼**只存在你的電腦本機**：
  - macOS：`~/Library/Application Support/floating-glucose/config.json`
  - Windows：`%APPDATA%\floating-glucose\config.json`
- 唯一的對外網路連線是：**你的電腦 → 你自己的 NS 網址**，跟你用瀏覽器打開 NS 是同一件事。
- 程式完全開源，你（或你信任的工程師朋友）可以審查所有程式碼，包含每一行網路請求。

---

## ❓ 常見問題

**Q1：為什麼數字一直顯示「載入中」或「ERR」？**
A：可能原因 (1) NS 網址打錯 (2) 密碼錯了 (3) 你的 NS 站台暫時沒回應 (4) 你的電腦沒網路。打開設定，按「Test connection」會明確告訴你錯在哪。

**Q2：為什麼數字變灰色？**
A：表示 Nightscout 上沒有新資料（預設超過 15 分鐘）。常見原因：手機沒網路、CGM 訊號斷了、歐態 / xDrip+ 在背景被系統 kill 了、CGM 感測器到期。請去檢查手機端的 CGM App 與 NS 網站。

**Q3：可以設成開機自動啟動嗎？**
A：可以。
- **Windows**：安裝時勾選「開機自動執行」
- **macOS**：系統設定 → 一般 → 登入項目 → 點 ➕ → 選 FloatingGlucose

**Q4：mg/dL 與 mmol/L 怎麼選？**
A：看你平常的 CGM / 血糖機顯示哪個。台灣、美國、日本、韓國用 **mg/dL**（例 120）；歐洲大部分國家、加拿大、澳洲、紐西蘭用 **mmol/L**（例 6.7）。換算：mg/dL ÷ 18 ≈ mmol/L。

**Q5：家裡有兩個糖友，一台電腦能同時看兩個人嗎？**
A：目前每台電腦只能存一組 NS 設定。建議用兩個 macOS / Windows 使用者帳號分開設定。

**Q6：浮動視窗會擋到我的全螢幕遊戲 / 影片嗎？**
A：在 macOS 上會浮在全螢幕應用程式之上（這是設計目的）；如果不想看到，可以拖到不會擋到的角落，或暫時取消勾選「顯示桌面浮動視窗」。

**Q7：要怎麼移除這個 App？**
A：**一般情況**直接用：
- **macOS**：把「應用程式」裡的 FloatingGlucose 拖到垃圾桶，並刪除 `~/Library/Application Support/floating-glucose/`
- **Windows**：控制台 → 程式集 → 解除安裝 FloatingGlucose

**如果遇到** Windows 跳「Installer integrity check has failed」、或 macOS App 找不到無法移除：請下載**完整移除工具**，雙擊執行即可：
- **Windows**：[uninstall-windows.cmd](https://github.com/bigtaffy/floating-glucose/raw/main/scripts/uninstall-windows.cmd)
  > 下載後在檔案上右鍵 → 內容 → 勾「**解除封鎖**」（Unblock）→ 確定，再雙擊執行。
- **macOS**：[uninstall-mac.command](https://github.com/bigtaffy/floating-glucose/raw/main/scripts/uninstall-mac.command)
  > 下載後在 Terminal 跑 `chmod +x ~/Downloads/uninstall-mac.command`，然後雙擊執行。

兩個工具會清掉：執行中的程式、安裝資料夾、設定檔（含 NS 密碼）、自動更新快取、捷徑、註冊表 / 偏好設定。執行完最後會列驗證結果，全 [OK] 就乾淨了。

**Q8：App 怎麼跟我的 CGM 通訊？**
A：**它不會跟你的 CGM 通訊**。它只跟你的 Nightscout 站台通訊。CGM → 手機 App → Nightscout 是另外一條鏈，由歐態 / xDrip+ 等 App 處理。

---

## 🌐 多國語言

支援以下介面語言（依系統語言自動偵測，亦可在設定中手動切換）：

- **繁體中文**（zh-TW）
- **简体中文**（zh-CN）
- **English**（en）
- **日本語**（ja）

歡迎協助翻譯！複製 `locales/en.json` → 改檔名為 `<語系代碼>.json` 翻譯後加進 `i18n.js` 的 `SUPPORTED` 陣列，再開 Pull Request 即可。

---

## 🙏 致謝

- 原始 Windows 版 [**FloatingGlucose**](https://github.com/bjornnyhus/FloatingGlucose) by Bjorn Inge Vikhammer — 本專案的設計藍本，使用者體驗、顏色語意、警報閾值預設值皆參考此專案
- [**Nightscout Project**](https://nightscout.github.io/) — 開源 CGM 雲端後端，本專案的資料源
- 歐態 / xDrip+ / Diabox / 600-series-android-uploader 等將 CGM 資料橋接到 NS 的開源作者群
- 第一型糖尿病社群、家長 Line 群、各位前輩的測試與回饋

---

## 🔧 給開發者

技術棧：[Electron](https://electronjs.org) + Node.js（無前端框架，純原生 HTML/CSS/JS）。

從原始碼跑：

```bash
git clone https://github.com/<你的GitHub>/floating-glucose.git
cd floating-glucose
npm install
npm start
```

打包：

```bash
npm run dist:mac    # 產生 .dmg（x64 + arm64）
npm run dist:win    # 產生 .exe (NSIS installer)
```

重生圖示（修改 `build/icon-source.png` 後）：

```bash
python3 scripts/round_icons.py
```

目錄結構：

```
floating-glucose/
├── main.js             # Electron 主行程：視窗、托盤、NS 抓取、設定 IO
├── preload.js          # contextBridge IPC
├── i18n.js             # 多語系載入器
├── renderer/
│   ├── floating.html   # 浮動視窗 UI
│   └── settings.html   # 設定畫面
├── locales/            # JSON 翻譯檔
│   ├── en.json
│   ├── zh-TW.json
│   ├── zh-CN.json
│   └── ja.json
├── assets/             # 執行時 tray 圖示 + Midjourney 原圖
├── build/              # electron-builder 用的圖示（icon.png/icns）
└── scripts/
    └── round_icons.py  # 圖示導角批次產生器
```

貢獻方式：直接開 Issue 或 PR 都歡迎。PR 請保持 commit 訊息英文（中英皆可，但英文便於國際協作）。

---

## 📄 License

[MIT](LICENSE) — 自由使用、修改、散布。但請保留 license 與致謝段落，並請務必保留**免責聲明**。
