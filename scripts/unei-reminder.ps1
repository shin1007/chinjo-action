# 運営の定期の提出のリマインダー（Windows のタスク スケジューラから毎朝9時に動かす）。
# 平日は毎朝、やることがある日（★）と毎週の初め（月曜。切れていたらその週に初めて動いたとき）に、画面に知らせを出す（週の初めは「次回は○月○日です。××の項目を…」も出す）。登録：powershell -File scripts/unei-reminder.ps1 -Register
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
$todo = ($out -split "`n" | Where-Object { $_ -match '★' }) -join "`n"
# 週の初めの知らせは、月曜に PC が切れていても、その週に初めて動いたときに出す（出した週を覚えておく）
$weekFile = Join-Path $env:LOCALAPPDATA 'chinjo-unei-week.txt'
$monday = (Get-Date).Date.AddDays(-(([int](Get-Date).DayOfWeek + 6) % 7)).ToString('yyyy-MM-dd')
$isMonday = -not ((Test-Path $weekFile) -and ((Get-Content $weekFile -Raw).Trim() -eq $monday))
# 2026-11-28：毎朝（PC を初めて使ったとき）出すようにした。電話・毎朝見る画面もメニューから1つの文字で開ける
$isWeekday = (Get-Date).DayOfWeek -notin 'Saturday', 'Sunday'
if ($todo -or $isMonday -or $isWeekday) {
  $msg = ''
  if ($todo) { $msg += "今日やること：`n$todo`n`n" }
  if ($isMonday) { Set-Content -Path $weekFile -Value $monday; $msg += ((& node "$root\scripts\unei.js" next) -join "`n") + "`n`n" }
  $ans = (New-Object -ComObject WScript.Shell).Popup("$($msg)メニューを開きますか？（t 電話の画面・o 毎朝見る画面も選べます）", 0, '陳情アクション：定期の提出', 4 + 64)
  if ($ans -eq 6) { Start-Process -FilePath "$root\定期の提出.cmd" -WorkingDirectory $root }
}
