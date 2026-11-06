param(
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

$scriptDirectory = if ($PSScriptRoot) {
  $PSScriptRoot
} else {
  Split-Path -Parent $MyInvocation.MyCommand.Path
}

$seedFile = Join-Path $scriptDirectory "seed-demo.mjs"

function Test-DockerCompose {
  try {
    docker compose version *> $null
    return $true
  } catch {
    return $false
  }
}

Write-Host "ATTENTION : ce script supprime toutes les données applicatives et tous les CV."
Write-Host "Il recrée ensuite 1 entreprise, 2 offres et 6 candidatures."

if (-not $Yes) {
  $answer = Read-Host "Tapez OUI pour continuer"
  if ($answer -ne "OUI") {
    Write-Host "Opération annulée."
    exit 1
  }
}

if (Test-DockerCompose) {
  Get-Content -LiteralPath $seedFile -Raw -Encoding UTF8 |
    docker compose exec -T web node --input-type=module
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
  Get-Content -LiteralPath $seedFile -Raw -Encoding UTF8 |
    docker-compose exec -T web node --input-type=module
} else {
  throw "Docker Compose est introuvable."
}
