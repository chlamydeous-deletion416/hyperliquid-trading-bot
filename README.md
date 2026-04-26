# Hyperliquid grid trading bot

**Repository:** [github.com/PolyPulse-Analytics/hyperliquid-trading-bot](https://github.com/PolyPulse-Analytics/hyperliquid-trading-bot)

A configurable grid strategy runner for [Hyperliquid](https://hyperliquid.xyz). It places layered buy and sell orders around a price range and supports basic risk rules (stop loss, take profit, drawdown limits, and rebalancing). The main implementation is **TypeScript on Node.js**; a legacy **Python** tree remains for reference and scripts.

> **Risk.** Trading digital assets and derivatives is risky. This repository is for education and research. You can lose your capital. **Use Hyperliquid testnet and small size until you understand the behavior.** The authors and contributors are not providing financial or legal advice.

---

## What you need

| Requirement | Notes |
|-------------|--------|
| [Node.js](https://nodejs.org/) **20.19 or newer** | Required for the main bot (`package.json` → `engines`). |
| A Hyperliquid **wallet (private key)** | For testnet: use a dedicated key; fund via [testnet faucet](https://faucet.chainstack.com/hyperliquid-testnet-faucet) or your preferred source. |
| `git` | To clone the repository. |

Optional: [uv](https://github.com/astral-sh/uv) if you use the Python examples under `learning_examples/` or `src/run_bot.py`.

---

## Install and run (main bot)

Follow these steps in order.

**1. Clone and install dependencies**

```bash
git clone https://github.com/PolyPulse-Analytics/hyperliquid-trading-bot
cd hyperliquid-trading-bot
npm install
```

**2. Environment file**

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- **Testnet:** `HYPERLIQUID_TESTNET_PRIVATE_KEY`, `HYPERLIQUID_TESTNET=true`, and the testnet URL variables if you use the defaults from `.env.example`.
- **Mainnet (real funds):** use the mainnet private key variable and `HYPERLIQUID_TESTNET=false` as described in `.env.example`. **Double-check YAML `exchange.testnet: false` for live trading.**

Never commit `.env` or share your private key.

**3. Bot configuration**

Configs live in `bots/*.yaml`. The sample `btc_conservative.yaml` is a conservative grid profile. Set `active: true` on the file you want the auto-discovery runner to pick (only one should be `active: true` if you rely on auto-discovery), or pass an explicit path when starting (see below).

**4. Validate, then start**

```bash
npm run validate
npm start
```

| Command | Purpose |
|--------|---------|
| `npm start` | Runs the bot using the first `active: true` config under `bots/`. |
| `npm run validate` | Checks that a selected YAML is structurally valid (no private key required for this step). |
| `npx tsx ts/src/runBot.ts path/to/config.yaml` | Runs with an explicit config file. |
| `npm test` | Runs automated tests (e.g. grid math). |

On **Ctrl+C**, the engine attempts to cancel open orders; review logs for your environment.

---

## How configuration fits together

- **`.env`** – Private keys, testnet flag, and API base URLs. See `.env.example` for all options and comments.
- **`bots/<name>.yaml`** – Strategy name, `exchange` (e.g. Hyperliquid, testnet on/off), `account` allocation, `grid` (symbol, levels, range), `risk_management`, and `monitoring.log_level`.

The TypeScript runner reads YAML and can override `exchange.testnet` with `HYPERLIQUID_TESTNET` in `.env` when set.

Example structure (illustrative; see `bots/btc_conservative.yaml` for the full, commented file):

```yaml
name: "my_grid"
active: true

exchange:
  type: "hyperliquid"
  testnet: true

account:
  max_allocation_pct: 10.0

grid:
  symbol: "BTC"
  levels: 10
  price_range:
    mode: "auto"
    auto:
      range_pct: 5.0

risk_management:
  stop_loss_enabled: false
  take_profit_enabled: false
  max_drawdown_pct: 15.0
  max_position_size_pct: 40.0
  rebalance:
    price_move_threshold_pct: 12.0

monitoring:
  log_level: "INFO"
```

---

## Risk features (overview)

When enabled in YAML, the stack can act on things like: stop loss, take profit, maximum drawdown, position size limits, and grid rebalancing when price moves outside your band. Defaults are conservative in spirit; read each flag in the sample bot file before enabling live trading.

---

## Python (legacy) and learning examples

The `src/` tree and `src/run_bot.py` are the older Python entrypoint. To use them:

```bash
uv sync
uv run src/run_bot.py --validate
uv run src/run_bot.py
```

Educational scripts (market data, orders, websockets) live under `learning_examples/`. Examples:

```bash
uv run learning_examples/01_websockets/realtime_prices.py
uv run learning_examples/02_market_data/get_all_prices.py
uv run learning_examples/04_trading/place_limit_order.py
```

Use testnet keys and small sizes when experimenting.

---

## Development

- **TypeScript:** `npx tsc --noEmit` for typecheck; `npm test` for tests.
- **Python:** `uv run …` as above; see `AGENTS.md` / `CLAUDE.md` for repository conventions if you contribute.

### Publishing to `PolyPulse-Analytics` (maintainers)

To create the GitHub org repository, set metadata (description, [Hyperliquid](https://hyperliquid.xyz) homepage, topics), and push `main`, use `scripts/publish-to-polypulse.ps1`. You need a [personal access token](https://github.com/settings/tokens) with permission to create repositories in the org. **Do not** commit tokens. In PowerShell, set `GITHUB_TOKEN` for the current session only, then run the script from the repository root. Revoke any token that was exposed (e.g. in chat or logs).

---

## License and disclaimer

This software is provided “as is,” without warranty of any kind. You are solely responsible for how you use it, for securing keys and API access, and for compliance with applicable laws and exchange rules in your jurisdiction.
