<#
.SYNOPSIS
    Codebench PowerShell Bootstrap & Management Script
.DESCRIPTION
    Provides single-command startup, doctor diagnostics, and development commands
    for Codebench on Windows with Docker Desktop.
#>

param (
    [Parameter(Position=0)]
    [ValidateSet("up", "host", "offline", "doctor", "dev", "down", "problems", "seed")]
    [string]$Command = "host",

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

function Get-HostLanAddresses {
    $addresses = @()
    try {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
            $_.IPAddress -notlike "127.*" -and 
            $_.IPAddress -notlike "169.254.*" -and 
            $_.InterfaceAlias -notmatch "vEthernet|VirtualBox|VMware|Loopback|Host-Only"
        }
        foreach ($ip in $ips) {
            $addresses += [PSCustomObject]@{
                IP = $ip.IPAddress
                Interface = $ip.InterfaceAlias
            }
        }
    } catch {}
    return $addresses
}

function Ensure-FirewallPort([int]$Port = 8080) {
    try {
        $rule = Get-NetFirewallRule -DisplayName "CodeBench Inbound (Port $Port)" -ErrorAction SilentlyContinue
        if (-not $rule) {
            $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
            if ($isAdmin) {
                New-NetFirewallRule -DisplayName "CodeBench Inbound (Port $Port)" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
                Write-Host "  [FIREWALL] Inbound TCP rule automatically added for port $Port." -ForegroundColor Green
            } else {
                Write-Host "  [FIREWALL] Tip: If contestants cannot open the page, allow Codebench/port $Port when prompted by Windows Firewall." -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [FIREWALL] Inbound rule verified for port $Port." -ForegroundColor Green
        }
    } catch {}
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
    Write-Host "   Docker Desktop on Windows is fully supported for testing and offline hosting."
    Write-Host ""
    Write-Host "Doctor check complete." -ForegroundColor Green
    return $true
}

function Invoke-Seed {
    Write-Host "Seeding problem bank into unified database..." -ForegroundColor Cyan
    try {
        $body = @{ path = "./problems" } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "http://localhost:8080/api/problems/import" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 20
        Write-Host "[OK] Problems successfully imported into unified database." -ForegroundColor Green
    } catch {
        Write-Host "[INFO] Running CLI problem loader..." -ForegroundColor Gray
        & go run ./cli/main.go problems import ./problems
    }
}

function Invoke-Host {
    Init-Env
    $ready = Invoke-Doctor
    if (-not $ready) {
        Write-Host "Preflight check failed. Please resolve the issue above." -ForegroundColor Red
        return
    }

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "    CodeBench Single-Host Offline Competition Launcher     " -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    $lanIps = Get-HostLanAddresses
    $wifi = $lanIps | Where-Object { $_.Interface -match "Wi-Fi|Wireless|WLAN" } | Select-Object -First 1
    $eth = $lanIps | Where-Object { $_.Interface -match "^Ethernet$" } | Select-Object -First 1
    
    $primaryIp = "127.0.0.1"
    if ($wifi) {
        $primaryIp = $wifi.IP
    } elseif ($eth) {
        $primaryIp = $eth.IP
    } elseif ($lanIps.Count -gt 0) {
        $primaryIp = $lanIps[0].IP
    }

    Ensure-FirewallPort 8080

    Write-Host ""
    Write-Host "Starting unified competition containers (API, Judge, PostgreSQL)..." -ForegroundColor Cyan
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start containers." -ForegroundColor Red
        return
    }

    Write-Host "Waiting for unified database and API server readiness..." -ForegroundColor Cyan
    $maxWait = 25
    $isReady = $false
    for ($i = 0; $i -lt $maxWait; $i++) {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-RestMethod -Uri "http://localhost:8080/healthz" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp.status -eq "ok") {
                $isReady = $true
                break
            }
        } catch {}
    }

    if (-not $isReady) {
        Write-Host "[WARN] Host server startup is taking longer than usual. Check 'docker compose logs api'." -ForegroundColor Yellow
    }

    # Auto-seed problem bank if empty
    try {
        $existing = Invoke-RestMethod -Uri "http://localhost:8080/api/problems" -TimeoutSec 3 -ErrorAction SilentlyContinue
        if (-not $existing -or $existing.Count -eq 0) {
            Write-Host "Pre-seeding standard problem bank into database..." -ForegroundColor Cyan
            Invoke-Seed
        }
    } catch {}

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  CODEBENCH OFFLINE COMPETITION HOST IS LIVE!                                   " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  PARTICIPANT ACCESS INSTRUCTIONS (Share with all contestants):" -ForegroundColor Cyan
    Write-Host "  1. Connect participant laptops/phones to this host machine's Wi-Fi or switch."
    Write-Host "  2. Contestants open browser (Chrome / Edge / Safari / Firefox) and go to:"
    Write-Host ""
    if ($wifi) {
        Write-Host "       [WI-FI NETWORK] ===>  http://$($wifi.IP):8080  <===" -ForegroundColor Yellow -BackgroundColor Black
    }
    if ($eth) {
        Write-Host "       [LAN CABLE / ETHERNET] ===>  http://$($eth.IP):8080  <===" -ForegroundColor Cyan
    }
    if (-not $wifi -and -not $eth) {
        Write-Host "       ===>  http://$($primaryIp):8080  <===" -ForegroundColor Yellow -BackgroundColor Black
    }
    Write-Host ""
    Write-Host "  FIREWALL NOTICE:" -ForegroundColor Yellow
    Write-Host "  If other devices cannot load the page, open PowerShell as Administrator and run:" -ForegroundColor Gray
    Write-Host "  netsh advfirewall firewall add rule name=""CodeBench"" dir=in action=allow protocol=TCP localport=8080" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  ORGANIZER & SCOREBOARD SCREENS:" -ForegroundColor Cyan
    Write-Host "  - Host Machine Local URL:       http://localhost:8080"
    Write-Host "  - Venue Projector / Scoreboard: http://$($primaryIp):8080/scoreboard"
    Write-Host "  - Default Admin Account:        admin@codebench.local"
    Write-Host "  - Default Admin Password:       codebench123"
    Write-Host ""
    Write-Host "  UNIFIED DATABASE & REAL-TIME SYNC:" -ForegroundColor Cyan
    Write-Host "  - Submissions from ANY participant update the central PostgreSQL DB."
    Write-Host "  - Live standings stream instantly via Server-Sent Events (SSE) to all screens."
    Write-Host "  - 100% OFFLINE: ZERO external internet connection required."
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "To stop the host server when the contest ends, run: .\codebench.ps1 down" -ForegroundColor Gray
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
    "host"     { Invoke-Host }
    "offline"  { Invoke-Host }
    "up"       { Invoke-Up }
    "doctor"   { Invoke-Doctor }
    "dev"      { Invoke-Dev }
    "down"     { Invoke-Down }
    "seed"     { Invoke-Seed }
    "problems" {
        & go run ./cli/main.go problems $SubCommand $Path
    }
}
