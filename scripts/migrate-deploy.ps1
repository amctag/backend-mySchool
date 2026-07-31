# Run Prisma without npx (avoids npm cache writes when disk is low)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Running prisma migrate deploy..."
node .\node_modules\prisma\build\index.js migrate deploy

Write-Host "Running prisma generate..."
node .\node_modules\prisma\build\index.js generate

Write-Host "Done."
