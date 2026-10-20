<#
.SYNOPSIS
    Codebench PowerShell Bootstrap & Management Script
.DESCRIPTION
    Provides single-command startup, doctor diagnostics, and development commands
    for Codebench on Windows with Docker Desktop.
#>

param (
    [Parameter(Position=0)]
    [ValidateSet("up", "doctor", "dev", "down", "problems")]
    [string]$Command = "up",

    [Parameter(Position=1)]
    [string]$SubCommand = "",

    [Parameter(Position=2)]
    [string]$Path = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Generate-SecureHex([int]$Length = 32) {
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
}

function Init-Env {
    $envFile = Join-Path $ScriptDir ".env"
    $envExample = Join-Path $ScriptDir ".env.example"
    if (-not (Test-Path $envFile)) {
        Write-Host "Creating .env from .env.example with secure random secrets..." -ForegroundColor Cyan
        $content = Get-Content $envExample -Raw
        $appSecret = Generate-SecureHex 32
        $natsToken = Generate-SecureHex 32
        $content = $content.Replace("change-this-to-a-secure-random-32-byte-hex-string", $appSecret)
        $content = $content.Replace("codebench-nats-internal-token-change-me", $natsToken)
        Set-Content -Path $envFile -Value $content -Encoding utf8
        Write-Host "Generated .env successfully." -ForegroundColor Green
    }
}

function Test-PortAvailable([int]$Port) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $iar = $tcpClient.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(200, $false)
        if ($success) {
            $tcpClient.EndConnect($iar)
            $tcpClient.Close()
            return $false
        }
        $tcpClient.Close()
        return $true
    } catch {
        return $true
    }
}

function Invoke-Doctor {
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "      Codebench System Doctor & Preflight  " -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan

    # 1. Docker Installed
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-Host "[FAIL] Docker is not installed or not in PATH." -ForegroundColor Red
        Write-Host "       Fix: Install Docker Desktop for Windows (https://www.docker.com/products/docker-desktop)"
        return $false
    } else {
        $dockerVer = & docker --version
        Write-Host "[OK] Docker is installed ($dockerVer)" -ForegroundColor Green
    }

    # 2. Docker Daemon Running
    try {
        $null = & docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] Docker Desktop daemon is not running." -ForegroundColor Red
            Write-Host "       Fix: Launch Docker Desktop from the Start menu and wait for the engine to start."
            return $false
        } else {
            Write-Host "[OK] Docker Desktop engine is running." -ForegroundColor Green
        }
    } catch {
        Write-Host "[FAIL] Could not connect to Docker engine." -ForegroundColor Red
        return $false
    }

    # 3. Docker Compose
    try {
        $composeVer = & docker compose version --short 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Docker Compose is available ($composeVer)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Docker Compose plugin is not working." -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[FAIL] Docker Compose could not be executed." -ForegroundColor Red
        return $false
    }

    # 4. Ports Check
    $ports = @(8080, 5432, 4222)
    foreach ($p in $ports) {
        if (-not (Test-PortAvailable $p)) {
            Write-Host "[WARN] Port $p is currently in use." -ForegroundColor Yellow
        } else {
            Write-Host "[OK] Port $p is available." -ForegroundColor Green
        }
    }

    # 5. Timing Grade
    Write-Host ""
    Write-Host "Evaluating Timing-Quality Grade:" -ForegroundColor Cyan
    Write-Host ">> Host environment: Windows (Docker Desktop / WSL2)" -ForegroundColor Yellow
    Write-Host ">> TIMING GRADE: Grade C (Development & Practice)" -ForegroundColor Yellow
    Write-Host "   Notice: Hypervisor virtualization adds timing jitter."
    Write-Host "   Docker Desktop on Windows is fully supported for testing and practice,"
    Write-Host "   while contest-grade timing requires tuned Linux bare-metal (Grade A)."
    Write-Host ""
    Write-Host "Doctor check complete." -ForegroundColor Green
    return $true
}

function Invoke-Up {
    Init-Env
    $ready = Invoke-Doctor
    if (-not $ready) {
        Write-Host "Preflight check failed. Please resolve the issue above." -ForegroundColor Red
        return
    }

    Write-Host ""
    Write-Host "Starting Codebench services with Docker Compose..." -ForegroundColor Cyan
    & docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start containers." -ForegroundColor Red
        return
    }

    Write-Host ""
    Write-Host "Waiting for services to become healthy..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Codebench is running!" -ForegroundColor Green
    Write-Host " Web UI & REST API:   http://localhost:8080" -ForegroundColor Green
    Write-Host " Status:              Online & Sandboxed" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}

function Invoke-Dev {
    Init-Env
    Write-Host "Starting Codebench in development mode..." -ForegroundColor Cyan
    & docker compose -f compose.yaml -f compose.dev.yaml up --build
}

function Invoke-Down {
    Write-Host "Stopping Codebench services..." -ForegroundColor Cyan
    & docker compose down
}

switch ($Command) {
    "up"       { Invoke-Up }
    "doctor"   { Invoke-Doctor }
    "dev"      { Invoke-Dev }
    "down"     { Invoke-Down }
    "problems" {
        & go run ./cli/main.go problems $SubCommand $Path
    }
}
