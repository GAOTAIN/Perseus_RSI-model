param([string]$VTubeStudioPath, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
if (Get-Process -Name 'VTube Studio' -ErrorAction SilentlyContinue) { throw 'Close VTube Studio before updating so the saved configuration can be updated safely.' }
$sourceModel = Join-Path $PSScriptRoot 'Perseus_RSI'
if (!$VTubeStudioPath) { throw 'Pass -VTubeStudioPath with your VTube Studio installation directory, or copy Perseus_RSI manually; see README.md.' }
$modelDirectory = Join-Path $VTubeStudioPath 'VTube Studio_Data\StreamingAssets\Live2DModels'
$destinationModel = Join-Path $modelDirectory 'Perseus_RSI'
if (!(Test-Path -LiteralPath (Join-Path $sourceModel 'Perseus_RSI.model3.json'))) { throw 'Missing source model. Keep this script next to the Perseus_RSI folder.' }
if (!(Test-Path -LiteralPath $modelDirectory -PathType Container)) { throw 'VTube Studio model directory was not found. See README.md for manual import.' }
Write-Host ('Source: ' + $sourceModel)
Write-Host ('Destination: ' + $destinationModel)
if ($DryRun) { Write-Host 'Dry run passed. No files changed.'; exit 0 }
if (Test-Path -LiteralPath $destinationModel) {
    $backupDirectory = Join-Path $PSScriptRoot ('Backup_Installed_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $backupDirectory | Out-Null
    Copy-Item -LiteralPath $destinationModel -Destination $backupDirectory -Recurse
    Write-Host ('Installed model backed up to: ' + $backupDirectory)
} else {
    New-Item -ItemType Directory -Path $destinationModel | Out-Null
}
Get-ChildItem -LiteralPath $sourceModel -Force | Where-Object { $_.Name -notlike '*.vtube.json' } | Copy-Item -Destination $destinationModel -Recurse -Force
$configurationPath = Join-Path $destinationModel 'Perseus_RSI.vtube.json'
if (Test-Path -LiteralPath $configurationPath) {
    $configuration = Get-Content -LiteralPath $configurationPath -Raw | ConvertFrom-Json
    $configuration.FileReferences.Icon = 'icon.png'
    foreach ($parameter in $configuration.ParameterSettings) {
        switch ($parameter.OutputLive2D) {
            'ParamAngleX' { $parameter.Smoothing = 8; $parameter.ClampOutput = $true }
            'ParamAngleY' { $parameter.Smoothing = 8; $parameter.ClampOutput = $true }
            'ParamAngleZ' { $parameter.Smoothing = 10; $parameter.ClampOutput = $true }
            'ParamBodyAngleZ' { $parameter.Smoothing = 24 }
            'ParamEyeLOpen' { $parameter.OutputRangeUpper = 1; $parameter.Smoothing = 6; $parameter.ClampOutput = $true }
            'ParamEyeROpen' { $parameter.OutputRangeUpper = 1; $parameter.Smoothing = 6; $parameter.ClampOutput = $true }
            'ParamMouthOpenY' { $parameter.OutputRangeUpper = 1; $parameter.Smoothing = 3; $parameter.ClampOutput = $true }
        }
    }
    $json = $configuration | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($configurationPath,$json,(New-Object System.Text.UTF8Encoding($false)))
}
Write-Host 'Update complete. Start VTube Studio and select Perseus_RSI. Camera, calibration and hotkeys were preserved; output ranges and smoothing were tuned.'
