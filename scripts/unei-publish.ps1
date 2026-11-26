# 運営の提出の記録（site/data/unei.js）を、ブランチ → プルリクエスト → main への取り込みまで進めて公開する。
# 定期の提出.cmd の「6」から呼ぶ。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (git status --porcelain -- site/data/unei.js docs/提言)) { Write-Output '公開する変更はありません。'; exit }
git checkout -q main; git pull -q
$branch = 'claude/unei-' + (Get-Date -Format 'yyyyMMdd-HHmm')
git checkout -q -b $branch
git add site/data/unei.js docs/提言
git commit -q -m "運営の提出の記録を足す（$(Get-Date -Format 'yyyy-MM-dd')）"
git push -q -u origin $branch
gh pr create --fill --body '定期の提出.cmd から、運営の提出の記録（site/data/unei.js）を公開する。'
gh pr merge --merge --delete-branch
git checkout -q main; git pull -q
Write-Output '公開しました（/unei と作成画面の札に反映されます）。'
