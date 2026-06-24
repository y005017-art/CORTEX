$env:CORTEX_API_BASE_URL = "http://127.0.0.1:8000"

$electronScript = Join-Path $PSScriptRoot "node_modules\.bin\electron.cmd"

if (-not (Test-Path $electronScript)) {
  throw "找不到 Electron 啟動腳本：$electronScript"
}

Start-Process -FilePath $electronScript -ArgumentList "." -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
