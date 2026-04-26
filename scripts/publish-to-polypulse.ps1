# Creates the org repo, sets description, homepage, topics, then pushes main.
# Usage (PowerShell, from repo root):
#   1) Revoke any token you pasted in chat; create a new PAT (repo, and org access if required).
#   2) Set the token only in your current session (do not commit .env with tokens):
#        $env:GITHUB_TOKEN = "<your-new-pat>"
#   3)  .\scripts\publish-to-polypulse.ps1
#
# The token is read from $env:GITHUB_TOKEN only. It is not stored in the repository.

$ErrorActionPreference = "Stop"

if (-not $env:GITHUB_TOKEN) {
  Write-Error "Set GITHUB_TOKEN in this shell first (PAT with permission to create repos in the org, e.g. repo scope + org access)."
}

$org = "PolyPulse-Analytics"
$repo = "hyperliquid-trading-bot"
$desc = "hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, "
$home = "https://hyperliquid.xyz"
$api = "https://api.github.com"
$headers = @{
  Authorization        = "Bearer $($env:GITHUB_TOKEN)"
  Accept                 = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$repoPath = "repos/$org/$repo"
$exists = $false
try {
  Invoke-RestMethod -Uri "$api/$repoPath" -Headers $headers -Method Get | Out-Null
  $exists = $true
} catch {
  if ($_.Exception.Response.StatusCode -ne 404) { throw }
}
if (-not $exists) {
  $body = @{
    name        = $repo
    description = $desc
    homepage    = $home
    private     = $false
  } | ConvertTo-Json
  try {
    Invoke-RestMethod -Uri "$api/orgs/$org/repos" -Headers $headers -Method Post -Body $body -ContentType "application/json" | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
      Write-Host "Repository may already exist; continuing."
    } else { throw }
  }
} else { Write-Host "Repository $org/$repo already exists; skipping create." }

$topicNames = @(
  "hyperliquid", "trading-bot", "cryptocurrency", "defi", "dex",
  "perpetual-futures", "grid-trading", "typescript", "nodejs", "viem",
  "automated-trading", "algorithmic-trading", "blockchain", "web3", "crypto",
  "trading", "bot", "perps", "decentralized-exchange", "market-making"
)
$topicBody = @{ names = $topicNames } | ConvertTo-Json -Compress
$topicHeaders = @{
  Authorization        = "Bearer $($env:GITHUB_TOKEN)"
  Accept                 = "application/vnd.github.mercy-preview+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}
Invoke-RestMethod -Uri "$api/$repoPath/topics" -Headers $topicHeaders -Method Put -Body $topicBody -ContentType "application/json" | Out-Null
Write-Host "Topics updated for $org/$repo."

$env:GH_TOKEN = $env:GITHUB_TOKEN
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Error "Install GitHub CLI (gh): https://cli.github.com/" }
& gh auth status | Out-Null
Set-Location (Split-Path $PSScriptRoot -Parent)
& gh auth setup-git
git remote set-url origin "https://github.com/$org/$repo.git"
git push -u origin main
Write-Host "Done. Remote: https://github.com/$org/$repo"
