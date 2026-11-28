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
  node scripts/unei.js next
  Write-Host ''
  Write-Host ' a  【毎日】まとめて：Issues（運営者の作業）を開く＋電話の画面（1日3件ほど）'
  Write-Host ''
  Write-Host ' ---- 個別に ----'
  Write-Host ' t  電話の画面だけ（議会の一覧・番号・台本・入力。ブラウザが開きます）'
  Write-Host ' n  X の投稿の24時間後の数字を入れる（記録の CSV に足して公開）'
  Write-Host ' m  毎月の応援（BMC の Webhook で数えられない分）を入れて、/trouble の運営費の図を作り直す'
  Write-Host ' r  手で開いて保存してほしい資料のページを、まとめてブラウザで開く（TODO の13の節）'
  Write-Host ' f  手で送る問い合わせフォームの一覧を開く（入れる内容のコピーつき）'
  Write-Host ' s  Supabase に SQL を反映する（毎日は不要。Claude が「反映して」と言ったときだけ。schema.sql をコピーして SQL Editor を開く。貼って Run）'
  Write-Host ''
  Write-Host ' 1  チームみらいに今週の項目を出す（ブラウザが開きます）'
  Write-Host ' 2  チームみらいに出す文面を見るだけ'
  Write-Host ' 3  議会・自治体の今の回の一覧（フォームの直リンク）'
  Write-Host ' 9  議会・自治体のフォームに文面と差出人を入れる（送信だけ自分で押す）'
  Write-Host ' c  コピー用の画面だけを開く（欄ごとのコピーのボタン）'
  Write-Host ' 4  手で出したものを記録する'
  Write-Host ' 5  今の回を「出した」にする'
  Write-Host ' 6  記録を公開する（コミットして main に取り込む）'
  Write-Host ' 7  カレンダーの .ics を作り直す'
  Write-Host ' 8  チームみらいへの提出を試す（文面を入れるところまで。送りません）'
  Write-Host ' d  済んだこと（出したもの）を見る'
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
    '8' { node scripts/unei.js mirai --trial }
    'd' { node scripts/unei.js done }
    '9' {
      $to = Read-Host '送り先（空のまま Enter で、まだ出していない次の送り先）'
      if ($to) { node scripts/unei-form.js $to } else { node scripts/unei-form.js }
    }
    'c' {
      $to = Read-Host '送り先（空のまま Enter で次の送り先）'
      if ($to) { node scripts/unei-form.js --copy $to } else { node scripts/unei-form.js --copy }
    }
    't' {
      # 別の窓で動かす（メニューはそのまま使える）。すでに動いていればブラウザで開くだけ
      Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$PWD'; node scripts/phone.js" -WindowStyle Minimized
      continue
    }
    'a' {
      # 毎日の分：Issues（運営者の作業）を開き、電話の画面を起動する（すでに動いていれば開くだけ）
      Start-Process 'https://github.com/shin1007/chinjo-action/issues?q=is%3Aopen+label%3A%E9%81%8B%E5%96%B6%E8%80%85%E3%81%AE%E4%BD%9C%E6%A5%AD'
      Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$PWD'; node scripts/phone.js" -WindowStyle Minimized
      Write-Host '電話は平日1日3件ほど（電話の画面の一覧の上から）。'
      continue
    }
    'n' { node scripts/post-stats.js }
    'm' {
      $usd = Read-Host '今月の毎月の応援の合計（ドル。例 15）'
      if ($usd) { gh workflow run support-month.yml -f extra_usd=$usd; Write-Host 'GitHub で動かしました。数分で図が直ります：https://github.com/shin1007/chinjo-action/actions/workflows/support-month.yml' }
    }
    'r' {
      $t = Get-Content 'docs/非公開/運営者のTODO.md' -Raw -Encoding UTF8
      $sec = [regex]::Match($t, '(?s)## 13\..*?(?=<a id=)').Value
      $urls = [regex]::Matches($sec, 'https?://[^\s)\]<>）]+') | ForEach-Object { $_.Value } | Select-Object -Unique
      Write-Host "$($urls.Count) 件のページを開きます。保存したら Downloads に置いたままで、Claude に「保存した」と伝える。"
      $urls | ForEach-Object { Start-Process $_ }
      continue
    }
    'f' { Start-Process (Resolve-Path 'docs/非公開/手で送る問い合わせフォーム.html'); continue }
    's' {
      Get-Content 'supabase/schema.sql' -Raw -Encoding UTF8 | Set-Clipboard
      Start-Process 'https://supabase.com/dashboard/project/oquuysfeistgpgrpeswq/sql/new'
      Write-Host 'schema.sql をコピーしました。開いた SQL Editor に Ctrl+V で貼って Run（何度実行しても同じ結果になる作り）。'
    }
    '0' { exit }
    default { Write-Host 'メニューの番号か文字を入れてください。' }
  }
  Write-Host ''
  Read-Host 'Enter でメニューに戻ります' | Out-Null
}
