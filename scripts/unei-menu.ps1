# 定期の提出.cmd（ダブルクリック）から開くメニュー。中身は scripts/unei.js を呼ぶだけ。
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = '陳情アクション：運営の定期の提出'
Set-Location (Split-Path -Parent $PSScriptRoot)
while ($true) {
  Clear-Host
  Write-Host '==== 陳情アクション：運営の定期の提出 ====' -ForegroundColor Cyan
  Write-Host ''
  node scripts/unei.js status
  Write-Host ''
  Write-Host ' 1  チームみらいに今週の項目を出す（ブラウザが開きます）'
  Write-Host ' 2  チームみらいに出す文面を見るだけ'
  Write-Host ' 3  議会・自治体の今の回の一覧（フォームの直リンク）'
  Write-Host ' 4  手で出したものを記録する'
  Write-Host ' 5  今の回を「出した」にする'
  Write-Host ' 6  記録を公開する（コミットして main に取り込む）'
  Write-Host ' 7  カレンダーの .ics を作り直す'
  Write-Host ' 0  終わる'
  Write-Host ''
  $n = Read-Host '番号を入れて Enter'
  switch ($n) {
    '1' { node scripts/unei.js mirai }
    '2' { node scripts/unei.js mirai --dry }
    '3' { node scripts/unei.js forms }
    '4' {
      $to = Read-Host '出した先（例：三鷹市議会）'
      $id = Read-Host '項目id（例：n_restore）'
      node scripts/unei.js record $to $id
    }
    '5' { node scripts/unei.js round-done }
    '6' { & "$PSScriptRoot\unei-publish.ps1" }
    '7' { node scripts/unei.js ics }
    '0' { exit }
    default { Write-Host '1〜7 か 0 を入れてください。' }
  }
  Write-Host ''
  Read-Host 'Enter でメニューに戻ります' | Out-Null
}
