# 運営の定期の提出のリマインダー（Windows のタスク スケジューラから毎朝9時に動かす）。
# やることがある日（★）だけ、画面に知らせを出す。登録：powershell -File scripts/unei-reminder.ps1 -Register
param([switch]$Register)
$root = Split-Path -Parent $PSScriptRoot
if ($Register) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $trigger = New-ScheduledTaskTrigger -Daily -At 9:00
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
  Register-ScheduledTask -TaskName 'chinjo-unei-reminder' -Action $action -Trigger $trigger -Settings $settings -Description '陳情アクション：チームみらいの週1・議会への3か月ごとの提出の知らせ' -Force | Out-Null
  Write-Output '登録しました：毎朝9時（PCが切れていたら次に起動したとき）'
  exit
}
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$out = (& node "$root\scripts\unei.js" status) -join "`n"
if ($out -match '★') {
  $todo = ($out -split "`n" | Where-Object { $_ -match '★' }) -join "`n"
  $ans = (New-Object -ComObject WScript.Shell).Popup("$todo`n`nメニュー（定期の提出.cmd）を開きますか？", 0, '陳情アクション：今日の提出', 4 + 64)
  if ($ans -eq 6) { Start-Process -FilePath "$root\定期の提出.cmd" -WorkingDirectory $root }
}
