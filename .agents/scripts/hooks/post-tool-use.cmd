@echo off
setlocal DisableDelayedExpansion

:: ==============================================================================
:: Semantic Circuit Breaker Post-Tool Hook Bridge for Antigravity & Orca IDE
:: Fase 3: Deterministic Circuit Breaker (Harness V8.1)
:: ==============================================================================

set "SCRIPT_DIR=%~dp0"
set "CIRCUIT_BREAKER_TS=%SCRIPT_DIR%..\circuit_breaker.ts"

if not exist "%CIRCUIT_BREAKER_TS%" (
  echo {}
  exit /b 0
)

:: Execute circuit breaker with bun in post-tool mode with auto-heal
bun run "%CIRCUIT_BREAKER_TS%" --post-tool --auto-heal %*
exit /b 0
