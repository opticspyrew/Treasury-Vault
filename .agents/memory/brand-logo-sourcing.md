---
name: Brand/asset logo sourcing for thumbnails
description: Where scam-asset/payment brand SVGs come from and which brands have no bundled mark.
---

# Brand logo sourcing

Scam-asset thumbnails use `simple-icons` (monochrome 24×24 paths, rendered with
`currentColor` inside the existing tone circles). Tron (TRX) and USD Coin (USDC)
are missing from simple-icons, so their 32×32 paths are embedded inline
(sourced from the `cryptocurrency-icons` set — package not kept as a dep).

**Why:** simple-icons lacks several trademarked brands entirely: Amazon,
Walmart, GCash, Sephora, Best Buy, Nordstrom. Those intentionally fall back to
the colored glyph badge — don't hunt for `siAmazon` etc., they don't exist.

**How to apply:** when adding a new brand thumbnail, check simple-icons first;
if missing, either embed a path or accept the glyph fallback. A dev-only visual
gallery of all mappings exists at `/dev/scam-thumbs` (DEV builds only).
