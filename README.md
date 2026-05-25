# 🤖 Hyperliquid Grid Trading Bot

**An intelligent grid trading strategy runner for Hyperliquid — automate layered orders with built-in risk management.**

[![GitHub](https://img.shields.io/badge/GitHub-SigmaTradeLabs-blue?logo=github)](https://github.com/SigmaTradeLabs/hyperliquid-trading-bot)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-gray)](LICENSE)

---

## 🎯 What This Bot Does

This bot **automatically places layered buy and sell orders** around your target price range on Hyperliquid. Think of it as a smart assistant that:

✅ Places multiple orders at different price levels (your "grid")  
✅ Automatically rebalances when the market moves  
✅ Protects your capital with stop-loss, take-profit, and drawdown limits  
✅ Logs everything for transparency and debugging  
✅ Runs 24/7 on testnet or mainnet (your choice)

**Perfect for:** Volatile markets, range-bound trading, automated income generation, and hands-off position management.

---

## ⚠️ Risk Warning

**Trading derivatives is risky.** You can lose your entire investment. This bot is for **education and research only**. 

🔴 **Before you start:**
- Start on **testnet** with fake funds
- Keep position sizes **small** while learning
- Always understand the strategy before running it
- Never share your private keys or `.env` file
- Read `bots/btc_conservative.yaml` to understand risk settings

**The authors provide no financial or legal advice. You are fully responsible for your trading decisions.**

---

## 📋 Prerequisites

You'll need just **three things**:

| What | Why | Link |
|-----|-----|------|
| **Node.js 20.19+** | Runs the bot engine | [Download Node.js](https://nodejs.org/) |
| **Hyperliquid Wallet** | Holds your trading funds | [Create wallet](https://hyperliquid.xyz) |
| **Git** | Clones this repository | [Get Git](https://git-scm.com/) |

**Optional:** [uv](https://github.com/astral-sh/uv) if you want to play with Python learning examples.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Clone the Repository

```bash
git clone https://github.com/SigmaTradeLabs/hyperliquid-trading-bot.git
cd hyperliquid-trading-bot
npm install
```

### Step 2: Set Up Your Environment

```bash
cp .env.example .env
```

Then edit `.env` and add your wallet's private key:

**For testnet (recommended first):**
```env
HYPERLIQUID_TESTNET=true
HYPERLIQUID_TESTNET_PRIVATE_KEY=your_testnet_private_key_here
```

**For mainnet (real money):**
```env
HYPERLIQUID_TESTNET=false
HYPERLIQUID_MAINNET_PRIVATE_KEY=your_mainnet_private_key_here
```

> 🔒 **Never commit `.env` to Git.** It's already in `.gitignore` — keep it that way.

### Step 3: Configure Your Strategy

The bot comes with a sample config: `bots/btc_conservative.yaml`

To use it, make sure it has `active: true`:

```yaml
name: "my_first_grid"
active: true           # ← Set this to true

exchange:
  type: "hyperliquid"
  testnet: true        # Change to false for mainnet

account:
  max_allocation_pct: 10.0  # Risk only 10% of your account

grid:
  symbol: "BTC"
  levels: 10           # 10 buy/sell orders per side
  price_range:
    mode: "auto"
    auto:
      range_pct: 5.0   # Grid spans ±5% around current price
```

### Step 4: Validate & Run

```bash
npm run validate      # Quick check for config errors
npm start             # 🤖 Bot is now trading!
```

Press **Ctrl+C** to stop. The bot will cancel all open orders.

---

## 📖 Understanding Your Configuration

All bot settings live in **one YAML file** under `bots/`.

### Basic Structure

```yaml
name: "my_bot_name"           # What to call this strategy
active: true                  # true = bot will auto-start, false = skip

exchange:
  type: "hyperliquid"         # Only option for now
  testnet: true               # true = testnet, false = mainnet

account:
  max_allocation_pct: 10.0    # Max % of wallet to use (safety limit)

grid:
  symbol: "BTC"               # Trading pair: BTC, ETH, SOL, etc.
  levels: 10                  # Number of orders on each side
  price_range:
    mode: "auto"              # Can be "auto" or "manual"
    auto:
      range_pct: 5.0          # Grid covers ±5% from current price

risk_management:
  stop_loss_enabled: false
  stop_loss_pct: 10.0
  take_profit_enabled: false
  take_profit_pct: 20.0
  max_drawdown_pct: 15.0      # Pause if down 15%
  rebalance:
    price_move_threshold_pct: 12.0

monitoring:
  log_level: "INFO"           # INFO, DEBUG, WARN, ERROR
```

### Key Settings Explained

**`grid.levels`** — How many buy orders below and sell orders above your center price  
→ More levels = thinner spreads, more orders to manage

**`price_range.auto.range_pct`** — How wide your grid spans  
→ 5% = grid from -5% to +5% of current price

**`max_allocation_pct`** — % of your wallet the bot can use  
→ 10% = max risk is 10% of your total funds

**`max_drawdown_pct`** — Bot pauses if losses hit this threshold  
→ 15% = shut down if down $15 per $100 in the account

---

## 🎓 Common Configurations

### 🛡️ Conservative (Low Risk, Slow Profit)
```yaml
grid:
  levels: 15
  price_range:
    auto:
      range_pct: 2.0
account:
  max_allocation_pct: 5.0
risk_management:
  max_drawdown_pct: 10.0
```

### ⚡ Aggressive (Higher Risk, Faster Profit)
```yaml
grid:
  levels: 5
  price_range:
    auto:
      range_pct: 10.0
account:
  max_allocation_pct: 25.0
risk_management:
  max_drawdown_pct: 25.0
```

### 💰 Balanced (Medium Risk)
```yaml
grid:
  levels: 10
  price_range:
    auto:
      range_pct: 5.0
account:
  max_allocation_pct: 15.0
risk_management:
  max_drawdown_pct: 15.0
```

---

## 🛠️ Commands & Tools

| Command | What It Does |
|---------|-------------|
| `npm start` | Run bot with first active config |
| `npm run validate` | Check config syntax (no keys needed) |
| `npx tsx ts/src/runBot.ts bots/my_config.yaml` | Run specific config |
| `npm test` | Run automated tests |
| `npm run debug` | Start with verbose logging |

---

## 🔄 How It Works (Under the Hood)

```
┌─────────────────────────────────────────────────────┐
│ 1. Bot Starts                                       │
│    Reads your .env (private key) + YAML config     │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ 2. Places Grid Orders                               │
│    Puts buy orders below + sell orders above        │
│    e.g., BTC at $43k, $42.9k, $42.8k (buy side)    │
│             $44k, $44.1k, $44.2k (sell side)       │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ 3. Monitor & Manage                                 │
│    Watch for fills, check risk limits, rebalance   │
│    Logs every action for transparency              │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ 4. Loop Until Stopped                               │
│    Repeat every few seconds (configurable)          │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Real Example Walkthrough

Let's say BTC is trading at **$43,000**:

**Your Config:**
- `levels: 5` (5 buy, 5 sell orders)
- `range_pct: 4.0` (±4% = $41,280 to $44,720)

**Bot Creates This Grid:**

```
SELL Orders (Above Price)     BUY Orders (Below Price)
─────────────────────────     ──────────────────────
Limit $44,720 (±4%)           Limit $41,280 (±4%)
Limit $44,344                 Limit $41,656
Limit $43,968 (←Mid)          Limit $42,032 (←Mid)
Limit $43,592                 Limit $42,408
Limit $43,216                 Limit $42,784
```

When price rises to $44,000 → sells execute → profit locked.  
When price drops to $42,000 → buys execute → averaging down.  
Rinse and repeat.

---

## 🐍 Python Examples (Educational)

Want to learn the API? Check out the learning examples:

```bash
# Install Python deps
uv sync

# Run examples
uv run learning_examples/01_websockets/realtime_prices.py
uv run learning_examples/02_market_data/get_all_prices.py
uv run learning_examples/04_trading/place_limit_order.py
```

Also see the legacy Python bot:
```bash
uv run src/run_bot.py --validate
uv run src/run_bot.py
```

---

## ❓ FAQ

### Q: Can I run multiple bots at once?
**A:** Not in auto-discovery mode (only one `active: true`). To run multiple, launch them separately with explicit config paths:
```bash
npx tsx ts/src/runBot.ts bots/btc_grid.yaml &
npx tsx ts/src/runBot.ts bots/eth_grid.yaml &
```

### Q: What's the minimum position size?
**A:** Depends on Hyperliquid's rules. Start with the testnet to find out—no real money lost if wrong.

### Q: Does the bot work 24/7?
**A:** Yes, as long as your server/machine stays on. Consider cloud hosting (AWS, DigitalOcean) for always-on trading.

### Q: How often does it check & rebalance?
**A:** Every few seconds (configurable). Check logs to see the exact interval.

### Q: Can I edit the config while the bot is running?
**A:** No. Stop the bot (Ctrl+C), edit the YAML, then restart.

### Q: What if my key is exposed?
**A:** Immediately revoke it in your Hyperliquid wallet settings and generate a new one. Never re-use a compromised key.

---

## 🐛 Troubleshooting

### Bot won't start
```bash
npm run validate
# Check for YAML syntax errors
# Verify .env file exists and has HYPERLIQUID_TESTNET_PRIVATE_KEY
```

### Orders aren't filling
- Check market liquidity (sparse market = wider spreads needed)
- Verify `price_range.range_pct` is wide enough
- Ensure your account has enough collateral
- Look at logs: `npm run debug`

### "Invalid private key" error
- Double-check `.env` for typos
- Verify you're using the **correct** key for testnet/mainnet
- Make sure the key is **hex-encoded** (no spaces)

### Bot stops unexpectedly
- Check logs for error messages
- Verify your API rate limits aren't exceeded
- Ensure the bot account still has collateral

### High slippage / orders not optimal
- Reduce `grid.levels` (fewer, thicker orders)
- Increase `price_range.range_pct` (wider bands)
- Trade more liquid pairs (BTC, ETH)

---

## 💡 Tips for Success

✅ **Start small** — Test on testnet with tiny amounts first  
✅ **Log everything** — Keep detailed records of all trades  
✅ **Monitor trends** — Grids work best in range-bound markets  
✅ **Set realistic limits** — 15% drawdown > 5% of actual risk  
✅ **Adjust gradually** — Change one setting at a time  
✅ **Read the docs** — Hyperliquid has nuances; understand them  
✅ **Use alerts** — Set up bot notifications (email, Telegram, Discord)

---

## 🔧 Advanced: Custom Configs

Need more control? Edit `bots/your_config.yaml` with all available options:

```yaml
grid:
  price_range:
    mode: "manual"           # Instead of auto
    manual:
      lower_bound: 40000
      upper_bound: 50000

risk_management:
  stop_loss_enabled: true
  stop_loss_pct: 8.0
  take_profit_enabled: true
  take_profit_pct: 15.0
  max_position_size_pct: 40.0
  rebalance:
    enabled: true
    price_move_threshold_pct: 12.0

monitoring:
  log_level: "DEBUG"         # Verbose logging
```

---

## 📚 Development & Contributing

### Local Development
```bash
# Typecheck
npx tsc --noEmit

# Run tests
npm test

# Run with debug logging
npm run debug
```

### Contributing
See `AGENTS.md` / `CLAUDE.md` for code style and conventions.

### Publishing (Maintainers)
Use `scripts/publish-to-polypulse.ps1` to push to GitHub (requires `GITHUB_TOKEN`).

---

## ⚖️ License & Disclaimer

**This software is provided "as is," without any warranty.** You are fully responsible for:
- Securing your private keys and API credentials
- Compliance with exchange rules and local laws
- Any financial losses from using this bot
- Ensuring your strategy aligns with your risk tolerance

Read the full license in the repository.

---

## 🤝 Get Help

- 📖 **Docs:** Check `README.md` and `bots/btc_conservative.yaml`
- 🐛 **Issues:** Report bugs on [GitHub Issues](https://github.com/SigmaTradeLabs/hyperliquid-trading-bot/issues)
- 💬 **Discussions:** Join the community for questions
- 📧 **Security:** Report vulnerabilities privately to maintainers

---

## 🎉 Next Steps

1. **Clone the repo** → `git clone ...`
2. **Set up `.env`** → Add your testnet key
3. **Run on testnet** → `npm start`
4. **Monitor logs** → Verify orders are placed correctly
5. **Tweak the config** → Experiment with different settings
6. **Graduate to mainnet** (optional) → When confident, switch to real funds

**Happy trading!** 🚀

---

*Last Updated: May 2026 | Maintained by SigmaTradeLabs*