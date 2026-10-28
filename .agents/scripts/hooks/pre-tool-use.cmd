@echo off
setlocal DisableDelayedExpansion

:: ==============================================================================
:: Semantic Circuit Breaker Hook Bridge for Antigravity & Orca IDE
:: Fase 3: Deterministic Circuit Breaker (Harness V8.1)
:: ==============================================================================

set "SCRIPT_DIR=%~dp0"
set "CIRCUIT_BREAKER_TS=%SCRIPT_DIR%..\circuit_breaker.ts"

if not exist "%CIRCUIT_BREAKER_TS%" (
  echo {"decision":"allow","reason":"Circuit breaker script not found, defaulting to allow"}
  exit /b 0
)

:: Execute circuit breaker with bun with auto-heal
bun run "%CIRCUIT_BREAKER_TS%" --auto-heal %*
set "EXIT_CODE=%errorlevel%"

if "%EXIT_CODE%"=="0" (
  exit /b 0
) else (
  exit /b 1
)
