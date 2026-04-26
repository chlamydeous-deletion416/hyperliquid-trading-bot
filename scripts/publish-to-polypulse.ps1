# Run from repo root. Requires: gh auth login (user with org admin on PolyPulse-Analytics)
$ErrorActionPreference = "Stop"
$org = "PolyPulse-Analytics"
$repo = "hyperliquid-trading-bot"
$desc = "hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, hyperliquid trading bot, "
$home = "https://hyperliquid.xyz"
gh repo create "$org/$repo" --public --homepage $home --description $desc 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "Note: if repo exists, continue to topics and push." }
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
