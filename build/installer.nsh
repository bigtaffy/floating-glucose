; Custom NSIS hooks for FloatingGlucose installer
; Goal: make installing a newer version succeed even when the previously-
; installed uninstaller has been corrupted by antivirus (Windows Defender
; sometimes truncates unsigned executables during scanning, which causes the
; default NSIS "uninstall old version before installing new" step to fail
; with "Installer integrity check has failed").
;
; Strategy: in customInit (runs before NSIS's built-in upgrade detection),
; kill any running instance, then delete the old uninstaller so the upgrade
; path falls through to a clean overwrite install.

!macro customInit
  ; Kill any running instance so the new installer can overwrite files
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 500

  ; Remove the old uninstaller (which may be corrupted). The new installer
  ; will write a fresh one. App files in $INSTDIR will be overwritten
  ; during the install section, so no orphan-file concern for our small app.
  IfFileExists "$INSTDIR\Uninstall ${APP_FILENAME}.exe" 0 +2
    Delete "$INSTDIR\Uninstall ${APP_FILENAME}.exe"
  IfFileExists "$LOCALAPPDATA\Programs\${APP_FILENAME}\Uninstall ${APP_FILENAME}.exe" 0 +2
    Delete "$LOCALAPPDATA\Programs\${APP_FILENAME}\Uninstall ${APP_FILENAME}.exe"
!macroend

; Also harden the uninstaller itself: if the user runs the uninstaller and
; it can't fully clean up, don't leave behind a stale registry entry that
; would block future installs.
!macro customUnInstall
  ; (Reserved for future cleanup steps — currently empty.)
!macroend
