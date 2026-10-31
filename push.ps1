<#
  push.ps1 —— CHU.LIFE 一键推送

  用法:
    .\push.ps1                      自动生成提交说明
    .\push.ps1 "改了 95 页面文案"    自定义提交说明
    .\push.ps1 -DryRun              只预览将要推送的改动,不提交

  原理:
    本目录不是 git 仓库(只是站点文件),脚本会在
    %LOCALAPPDATA%\CHU.LIFE-push-repo 维护一个「只存索引」的仓库,
    再把当前目录当作工作区比对、提交、推送。
    只会上传「本地有、且和远程不同」的文件;远程有而本地没有的文件不会被删除。
#>
param(
  [string]$Message = '',
  [switch]$DryRun
)

# 注意:git 会把进度/提示写到 stderr,PowerShell 5.1 在 Stop 模式下会误判为错误,
# 所以这里用 Continue,失败与否统一用 $LASTEXITCODE 判断后再 throw。
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Work = Join-Path $env:LOCALAPPDATA 'CHU.LIFE-push-repo'
$Remote = 'https://github.com/chu100210/chu100210.github.io.git'
$Branch = 'main'
$gd = Join-Path $Work '.git'

function Run-Git {
  param([string[]]$GitArgs)
  & git --git-dir="$gd" --work-tree="$Root" @GitArgs
}

Write-Host ''
Write-Host '===== CHU.LIFE 一键推送 =====' -ForegroundColor Cyan
Write-Host "站点目录 : $Root"
Write-Host "推送缓存 : $Work"
Write-Host ''

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw '未找到 git,请先安装 Git for Windows 并确保 git 在 PATH 中。'
}

# ---------- 1. 准备推送仓库 ----------
if (-not (Test-Path $gd)) {
  Write-Host '[1/5] 首次运行,正在初始化推送仓库…' -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path $Work | Out-Null
  & git -C $Work init -b $Branch 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & git -C $Work init | Out-Null
    & git -C $Work symbolic-ref HEAD "refs/heads/$Branch"
  }
  & git -C $Work remote add origin $Remote
  & git -C $Work config user.name 'chujunxi'
  & git -C $Work config user.email '2247404389@qq.com'
} else {
  Write-Host '[1/5] 使用已有推送仓库' -ForegroundColor DarkGray
}

# 提交时统一转成 LF,但不做检出转换;这样无需下载历史内容,速度也快
& git -C $Work config core.autocrlf input
& git -C $Work config core.safecrlf false

# ---------- 2. 拉取远程最新(只取目录树,不下载图片等大文件) ----------
# 上次中断可能残留锁文件,先清掉
$lockFile = Join-Path $gd 'index.lock'
if (Test-Path $lockFile) {
  try {
    Remove-Item $lockFile -Force -ErrorAction Stop
    Write-Host '      已清理上次中断残留的 index.lock' -ForegroundColor DarkYellow
  } catch {
    throw "推送缓存被占用,请关闭其它 git 窗口后重试: $lockFile"
  }
}

Write-Host '[2/5] 正在连接 GitHub…' -ForegroundColor Yellow
& git -C $Work fetch --depth 1 --filter=blob:none origin $Branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw '拉取失败:请检查网络 / 代理(FlClash 是否已启动),然后重试。'
}

# ---------- 3. 让索引与远程最新一致(不动本地文件) ----------
& git --git-dir="$gd" update-ref "refs/heads/$Branch" FETCH_HEAD
& git --git-dir="$gd" symbolic-ref HEAD "refs/heads/$Branch"
& git --git-dir="$gd" read-tree FETCH_HEAD | Out-Null
if ($LASTEXITCODE -ne 0) { throw '索引对齐失败,请删除缓存目录后重试:' + $Work }

# ---------- 4. 暂存本地改动(忽略删除,避免误删远程文件) ----------
Write-Host '[3/5] 正在比对本地文件…' -ForegroundColor Yellow
$null = Run-Git -GitArgs @('add', '--ignore-removal', '.') 2>&1
if ($LASTEXITCODE -ne 0) { throw '暂存失败,请查看上面的 git 输出。' }

$changed = @(& git --git-dir="$gd" --work-tree="$Root" diff-index --cached --name-status HEAD)
if ($LASTEXITCODE -ne 0) { throw '读取改动列表失败。' }

if (-not $changed -or $changed.Count -eq 0) {
  Write-Host ''
  Write-Host '没有需要推送的改动,远程已是最新。' -ForegroundColor Green
  exit 0
}

Write-Host ''
Write-Host '将要推送的文件:' -ForegroundColor Cyan
$changed | ForEach-Object {
  $line = $_.ToString()
  if ($line.Trim()) {
    if ($line -match '^A\s+(.+)$') { Write-Host ("  + " + $Matches[1]) -ForegroundColor Green }
    elseif ($line -match '^M\s+(.+)$') { Write-Host ("  ~ " + $Matches[1]) -ForegroundColor Yellow }
    else { Write-Host ("  " + $line) -ForegroundColor Gray }
  }
}
Write-Host ''

if ($DryRun) {
  Write-Host 'DryRun:仅预览,未提交也未推送。' -ForegroundColor Magenta
  exit 0
}

# ---------- 5. 提交并推送 ----------
if (-not $Message) { $Message = 'site update: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }

Write-Host '[4/5] 正在创建提交…' -ForegroundColor Yellow
$commitText = (Run-Git -GitArgs @('commit', '-m', $Message) 2>&1 | Out-String)
$commitExit = $LASTEXITCODE
if ($commitText.Trim()) { Write-Host $commitText.TrimEnd() }
if ($commitExit -ne 0) { throw '提交失败,请查看上面的 git 输出。' }

Write-Host '[5/5] 正在推送到 GitHub…' -ForegroundColor Yellow
$pushText = (& git --git-dir="$gd" --work-tree="$Root" push origin "HEAD:$Branch" 2>&1 | Out-String)
$pushExit = $LASTEXITCODE
if ($pushText.Trim()) { Write-Host $pushText.TrimEnd() }
if ($pushExit -ne 0) {
  throw '推送失败:请检查网络 / 代理,或确认 GitHub 账号是否已授权。'
}

Write-Host ''
Write-Host '推送成功 ✅   GitHub Pages 约 1~2 分钟后更新。' -ForegroundColor Green
Write-Host ''
