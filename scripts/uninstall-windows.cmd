@echo off
setlocal
chcp 65001 > nul
title FloatingGlucose 完整移除工具

cls
echo.
echo  =====================================================
echo   FloatingGlucose 完整移除工具 / Full Uninstaller
echo  =====================================================
echo.
echo  將清除以下項目 / Will remove:
echo    [-] 執行中的程式            Running process
echo    [-] 安裝資料夾              Install folder
echo    [-] 個人設定 (含 NS 密碼)    Settings (NS password!)
echo    [-] 自動更新快取            Auto-updater cache
echo    [-] 開始功能表 / 桌面捷徑    Start menu and desktop shortcuts
echo    [-] 註冊表「已安裝」紀錄    Registry uninstall entries
echo    [-] 開機自動啟動條目        Startup entries
echo.
echo  -----------------------------------------------------
echo   不會清除 / Will NOT touch:
echo    - 你的 Nightscout 站台      Your Nightscout server
echo    - 任何其他應用程式          Any other applications
echo  -----------------------------------------------------
echo.
choice /C YN /N /M " 確認執行嗎? (Y/N) "
if errorlevel 2 (
    echo.
    echo  已取消 / Cancelled.
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo  開始清除... / Cleaning up...
echo.

powershell -NoProfile -Command "Write-Host ' [1/7] 停止程式            Stopping process...'; Stop-Process -Name FloatingGlucose -Force -ErrorAction SilentlyContinue"

powershell -NoProfile -Command "Write-Host ' [2/7] 移除安裝資料夾      Removing install folder...'; Remove-Item -Recurse -Force \"$env:LOCALAPPDATA\Programs\FloatingGlucose\" -ErrorAction SilentlyContinue"

powershell -NoProfile -Command "Write-Host ' [3/7] 移除個人設定        Removing user settings...'; Remove-Item -Recurse -Force \"$env:APPDATA\floating-glucose\" -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force \"$env:APPDATA\FloatingGlucose\" -ErrorAction SilentlyContinue"

powershell -NoProfile -Command "Write-Host ' [4/7] 移除更新快取        Removing updater cache...'; Remove-Item -Recurse -Force \"$env:LOCALAPPDATA\floating-glucose-updater\" -ErrorAction SilentlyContinue"

powershell -NoProfile -Command "Write-Host ' [5/7] 移除捷徑            Removing shortcuts...'; Remove-Item -Recurse -Force \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FloatingGlucose*\" -ErrorAction SilentlyContinue; Remove-Item -Force \"$env:USERPROFILE\Desktop\FloatingGlucose*.lnk\" -ErrorAction SilentlyContinue"

powershell -NoProfile -Command "Write-Host ' [6/7] 清除註冊表          Cleaning registry...'; Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('DisplayName') -like '*FloatingGlucose*' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"

powershell -NoProfile -Command "Write-Host ' [7/7] 移除開機啟動條目    Removing startup entry...'; Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'FloatingGlucose' -ErrorAction SilentlyContinue"

echo.
echo  =====================================================
echo   檢查結果 / Verification
echo  =====================================================
powershell -NoProfile -Command "$p = @(Get-Process FloatingGlucose -ErrorAction SilentlyContinue).Count; if ($p -eq 0) { Write-Host '   執行程式 Process:      [OK] 0 個' -ForegroundColor Green } else { Write-Host \"   執行程式 Process:      [FAIL] still $p running\" -ForegroundColor Red }"
powershell -NoProfile -Command "if (Test-Path \"$env:LOCALAPPDATA\Programs\FloatingGlucose\") { Write-Host '   安裝資料夾 Install:    [FAIL] still exists' -ForegroundColor Red } else { Write-Host '   安裝資料夾 Install:    [OK] removed' -ForegroundColor Green }"
powershell -NoProfile -Command "if (Test-Path \"$env:APPDATA\floating-glucose\") { Write-Host '   個人設定 Settings:     [FAIL] still exists' -ForegroundColor Red } else { Write-Host '   個人設定 Settings:     [OK] removed' -ForegroundColor Green }"
powershell -NoProfile -Command "if (Test-Path \"$env:LOCALAPPDATA\floating-glucose-updater\") { Write-Host '   更新快取 Updater:      [FAIL] still exists' -ForegroundColor Red } else { Write-Host '   更新快取 Updater:      [OK] removed' -ForegroundColor Green }"
powershell -NoProfile -Command "$r = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('DisplayName') -like '*FloatingGlucose*' }).Count; if ($r -eq 0) { Write-Host '   註冊表 Registry:       [OK] clean' -ForegroundColor Green } else { Write-Host \"   註冊表 Registry:       [FAIL] $r entries left\" -ForegroundColor Red }"

echo.
echo  =====================================================
echo   完成 / Done!
echo  =====================================================
echo.
echo  下一步 / Next step:
echo    下載 v1.0.2 重新安裝 / Download and install v1.0.2:
echo    https://github.com/bigtaffy/floating-glucose/releases/latest
echo.
pause
endlocal
