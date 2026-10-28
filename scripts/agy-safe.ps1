<#
.SYNOPSIS
    Wrapper seguro para Antigravity CLI con Semantic Circuit Breaker Activo (Fase 3 - Harness V8.1).

.DESCRIPTION
    Ejecuta 'agy' asegurando la inicialización del Circuit Breaker determinista,
    la verificación de la lista blanca inmutable y el monitoreo de límites anti-loop
    (máx. 12 lecturas consecutivas ciegas, máx. 3 fallos consecutivos por herramienta).

.PARAMETER Reset
    Resetea el contador de herramientas en _workspace/tool_counter.json antes de iniciar.

.PARAMETER Status
    Muestra el estado actual del Circuit Breaker sin iniciar agy.

.EXAMPLE
    .\scripts\agy-safe.ps1 -c
    Reanuda la última conversación con el Circuit Breaker activo.

.EXAMPLE
    .\scripts\agy-safe.ps1 --reset -c
    Resetea contadores y reanuda la conversación.
#>

[CmdletBinding(PositionalBinding = $false)]
param(
    [Alias("r")]
    [switch]$Reset,
    [Alias("ro", "ResetOnly")]
    [switch]$CleanOnly,
    [Alias("s")]
    [switch]$Status,
    [Parameter(Mandatory = $false, ValueFromRemainingArguments = $true)]
    [string[]]$AgyArgs
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$CircuitBreakerTs = Join-Path $ProjectRoot ".agents\scripts\circuit_breaker.ts"
$CounterFile = Join-Path $ProjectRoot "_workspace\tool_counter.json"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Antigravity CLI - Safe Session (Harness V8.1 Active)    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $CircuitBreakerTs)) {
    Write-Warning "No se encontró el script de Circuit Breaker en $CircuitBreakerTs. Continuando sin breaker..."
} else {
    if ($Reset -or $CleanOnly) {
        Write-Host "[CircuitBreaker] Reseteando contadores de herramientas..." -ForegroundColor Yellow
        bun run "$CircuitBreakerTs" --reset --counter-file "$CounterFile"
        if ($CleanOnly) { return }
    }

    if ($Status) {
        Write-Host "[CircuitBreaker] Estado actual:" -ForegroundColor Yellow
        bun run "$CircuitBreakerTs" --status --counter-file "$CounterFile"
        return
    }

    Write-Host "[CircuitBreaker] Inmutable Whitelist: " -NoNewline -ForegroundColor Green
    Write-Host "send_message, ask_question, ask_permission, write_file, edit_file, write_to_file, replace_file_content" -ForegroundColor Gray
    Write-Host "[CircuitBreaker] Umbrales: " -NoNewline -ForegroundColor Green
    Write-Host "Máx 12 lecturas ciegas | Máx 3 fallos consecutivos" -ForegroundColor Gray
    Write-Host "[CircuitBreaker] Registro: " -NoNewline -ForegroundColor Green
    Write-Host "$CounterFile" -ForegroundColor Gray
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
}

$env:CIRCUIT_BREAKER_ACTIVE = "1"
$env:TOOL_COUNTER_FILE = "$CounterFile"

# Verificar si agy está disponible en PATH
$agyCmd = Get-Command "agy" -ErrorAction SilentlyContinue
if (-not $agyCmd) {
    Write-Warning "No se encontró el comando 'agy' en el PATH. Verifique la instalación de Antigravity CLI."
    return
}

Write-Host "[agy-safe] Iniciando agy con argumentos: $($AgyArgs -join ' ')" -ForegroundColor DarkCyan
try {
    & agy @AgyArgs
} finally {
    if (Test-Path $CircuitBreakerTs) {
        Write-Host ""
        Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host "[agy-safe] Sesión finalizada. Resumen de herramientas:" -ForegroundColor Cyan
        bun run "$CircuitBreakerTs" --status --counter-file "$CounterFile"
    }
}
