---
name: Refunds.site / CryptoVault seam
description: How the Refunds.site brand coexists with CryptoVault inside the crypto-dashboard app without visual or code bleed.
---

# Refunds.site ↔ CryptoVault isolation

Refunds.site lives inside the existing `crypto-dashboard` app (not a separate
artifact) under the `/refunds/*` route prefix and the `src/refunds/` folder.

**Rule:** Keep the two products fully isolated.
- All Refunds UI is wrapped in a `.refunds-scope` element. That class redefines
  the Tailwind CSS variables (`--primary`, `--card`, etc.) to the Refunds palette,
  so Tailwind utilities (`bg-primary`, `text-foreground`, …) resolve to Refunds
  colors only inside the scope — CryptoVault is untouched.
- Never import a component across the seam (Refunds → CryptoVault pages or vice
  versa). The route prefix `/refunds` and the `src/refunds/` folder are the boundary.
- Refunds-specific tokens/utilities/animations are namespaced `refunds-*` in
  `src/index.css` (glass, grid, radial, vault-bg, scan-line, pulse-ring, etc.) and
  all animations are gated behind `prefers-reduced-motion`.

**Why:** The user explicitly required that adding Refunds must not change the
CryptoVault look. The scoped-CSS-variable approach lets both brands share Tailwind
without a second config.

**How to apply:** New Refunds screens go under `src/refunds/`, are mounted at a
`/refunds/*` route in `App.tsx`, and their root element carries `refunds-scope`.
Data is mock-only behind `get*()` read functions in `src/refunds/data/mocks.ts` so
a future backend swap touches only the data layer.

**Motion note:** The marketing homepage (`src/refunds/pages/landing.tsx`) wraps its
sections in framer-motion `<MotionConfig reducedMotion="user">` so all JS-driven
animations honor reduced-motion, complementing the CSS-level guard.
