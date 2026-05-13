#!/usr/bin/env bash
# FloatingGlucose 完整移除工具 (macOS)
# 用法：在 Finder 雙擊此檔，或於 Terminal 執行 `bash uninstall-mac.command`

set -u

echo ""
echo " ====================================================="
echo "  FloatingGlucose 完整移除工具 / Full Uninstaller"
echo " ====================================================="
echo ""
echo " 將清除以下項目 / Will remove:"
echo "   [-] 執行中的程式            Running process"
echo "   [-] App 本體                /Applications/FloatingGlucose.app"
echo "   [-] 個人設定 (含 NS 密碼)    Settings (NS password!)"
echo "   [-] 自動更新快取            Auto-updater cache"
echo "   [-] 偏好設定 (.plist)        Preferences"
echo "   [-] Saved state             Window state"
echo ""
echo " -----------------------------------------------------"
echo "  不會清除 / Will NOT touch:"
echo "   - 你的 Nightscout 站台      Your Nightscout server"
echo "   - 任何其他應用程式          Any other applications"
echo "   - 系統設定 → 登入項目        Login Items (請手動移除)"
echo " -----------------------------------------------------"
echo ""
read -rp " 確認執行嗎? (y/N) " confirm
case "$confirm" in
    [yY]|[yY][eE][sS]) ;;
    *) echo " 已取消 / Cancelled."; sleep 2; exit 0 ;;
esac

echo ""
echo " 開始清除... / Cleaning up..."
echo ""

green()  { printf "   \033[32m%s\033[0m\n" "$1"; }
red()    { printf "   \033[31m%s\033[0m\n" "$1"; }

echo " [1/6] 停止程式            Stopping process..."
pkill -f FloatingGlucose 2>/dev/null || true
sleep 1

echo " [2/6] 移除 App            Removing app..."
rm -rf "/Applications/FloatingGlucose.app"

echo " [3/6] 移除個人設定        Removing user settings..."
rm -rf "$HOME/Library/Application Support/floating-glucose"
rm -rf "$HOME/Library/Application Support/FloatingGlucose"

echo " [4/6] 移除更新快取與 logs  Removing updater cache and logs..."
rm -rf "$HOME/Library/Caches/com.example.floatingglucose"
rm -rf "$HOME/Library/Caches/FloatingGlucose"
rm -rf "$HOME/Library/Caches/floating-glucose-updater"
rm -rf "$HOME/Library/Logs/FloatingGlucose"
rm -rf "$HOME/Library/Logs/floating-glucose"

echo " [5/6] 移除偏好設定        Removing preferences..."
rm -f "$HOME/Library/Preferences/com.example.floatingglucose.plist"

echo " [6/6] 移除 saved state    Removing saved window state..."
rm -rf "$HOME/Library/Saved Application State/com.example.floatingglucose.savedState"

echo ""
echo " ====================================================="
echo "  檢查結果 / Verification"
echo " ====================================================="

if pgrep -f FloatingGlucose >/dev/null 2>&1; then
    red "執行程式 Process:      [FAIL] 仍在執行 / still running"
else
    green "執行程式 Process:      [OK] 0 個"
fi

if [ -e "/Applications/FloatingGlucose.app" ]; then
    red "App 本體 App bundle:   [FAIL] 仍存在 / still exists"
else
    green "App 本體 App bundle:   [OK] removed"
fi

if [ -e "$HOME/Library/Application Support/floating-glucose" ]; then
    red "個人設定 Settings:     [FAIL] 仍存在 / still exists"
else
    green "個人設定 Settings:     [OK] removed"
fi

if [ -e "$HOME/Library/Preferences/com.example.floatingglucose.plist" ]; then
    red "偏好設定 Preferences:  [FAIL] 仍存在 / still exists"
else
    green "偏好設定 Preferences:  [OK] removed"
fi

echo ""
echo " ====================================================="
echo "  完成 / Done!"
echo " ====================================================="
echo ""
echo "  如果之前設過開機自動啟動，請手動移除："
echo "    系統設定 → 一般 → 登入項目與擴充功能 → 找 FloatingGlucose → 按 -"
echo ""
echo "  Login item (if you set it up) — remove manually at:"
echo "    System Settings → General → Login Items → FloatingGlucose → minus"
echo ""
echo "  下一步 / Next step:"
echo "    下載 v1.0.2 重新安裝 / Download and install v1.0.2:"
echo "    https://github.com/bigtaffy/floating-glucose/releases/latest"
echo ""
read -rp " 按 Enter 結束 / Press Enter to close..." _ || true
