# Run from repo root. Requires: gh auth login (user with org admin on PolyPulse-Analytics)
$ErrorActionPreference = "Stop"
$org = "PolyPulse-Analytics"
$repo = "hyperliquid-trading-bot"
$desc = "hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, "
$home = "https://hyperliquid.xyz"
gh repo view "$org/$repo" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh repo create "$org/$repo" --public --homepage $home --description $desc
} else {
  Write-Host "Repository $org/$repo already exists; skipping create."
}
$names = @(
  "hyperliquid", "trading-bot", "cryptocurrency", "defi", "dex",
  "perpetual-futures", "grid-trading", "typescript", "nodejs", "viem",
  "automated-trading", "algorithmic-trading", "blockchain", "web3", "crypto",
  "trading", "bot", "perps", "decentralized-exchange", "market-making"
)
$payload = @{ names = $names } | ConvertTo-Json -Compress
$payload | gh api --method PUT -H "Accept: application/vnd.github.mercy-preview+json" "repos/$org/$repo/topics" --input -
Set-Location (Split-Path $PSScriptRoot -Parent)
git remote set-url origin "https://github.com/$org/$repo.git"
git push -u origin main
