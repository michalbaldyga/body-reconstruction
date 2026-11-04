param([switch]$Dev)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableNode = Join-Path $PSScriptRoot '.tools/node-v22.16.0-win-x64'
if (Test-Path (Join-Path $portableNode 'node.exe')) { $env:Path = "$portableNode;$env:Path" }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Zainstaluj Node.js 22.12+ lub nowszy LTS i uruchom ponownie.' }
if (-not (Test-Path 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Instalacja nie powiodla sie.' } }
if ($Dev) { & npm.cmd run dev }
else {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Budowa aplikacji nie powiodla sie.' }
    & npm.cmd run preview -- --port 4173
}
