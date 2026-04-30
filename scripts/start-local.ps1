Param(
  [switch]$RunRlsTest
)

function Ensure-Command($cmd) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "$cmd not found. Please install Node.js (includes npm) from https://nodejs.org/ and reopen PowerShell." -ForegroundColor Red
    exit 1
  }
}

Ensure-Command node
Ensure-Command npm

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

if ($RunRlsTest) {
  if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_ANON_KEY -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "SUPABASE env vars missing. Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY before running the RLS test." -ForegroundColor Yellow
  } else {
    Write-Host "Running RLS test script..." -ForegroundColor Cyan
    npx ts-node-esm scripts/test-rls.ts
  }
}

Write-Host "Starting dev server in a new PowerShell window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit','-Command','npm run dev'
