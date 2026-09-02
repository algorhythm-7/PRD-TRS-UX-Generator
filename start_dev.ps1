$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot 'app')

if (-not (Test-Path 'node_modules' -PathType Container)) {
    Write-Host 'Installing dependencies...'
    npm install
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

npm run dev
exit $LASTEXITCODE
