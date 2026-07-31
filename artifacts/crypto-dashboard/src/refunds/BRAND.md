# Refunds.site — Brand & Design System Reference

Refunds.site is an enterprise-grade digital asset recovery and cyber intelligence
platform. The brand must feel **institutional, secure, forensic, and intelligent** —
closer to a blockchain intelligence firm or enterprise SOC product than a consumer
fintech app.

> A live, browsable version of this reference lives at `/refunds/brand`.

---

## 1. Voice & Tone

- **Forensic, never promotional.** State capabilities, not outcomes.
- **Compliance-aware.** Reference SOC 2, ISO 27001, AML/KYC controls when relevant.
- **No guarantees.** Never use phrases like "100% recovery", "guaranteed refund",
  "we always recover funds", or fabricated testimonials.
- **Plain enterprise English.** Avoid hype words ("blazing fast"), urgency
  pressure ("act now"), and slang.
- **Always name the limit.** When describing what we do, also name what we do
  *not* do (we do not custody assets, we do not contact counterparties on your
  behalf without authorization, etc.).

---

## 2. Logo Direction

The mark is a **hex-shielded vault glyph**: a hexagon outline (intelligence /
network), with a stylized "R" formed by a vault dial inside it. Two thin scan
lines cross the dial to signal forensic analysis.

- Always uses the cyber-teal primary on dark vault background.
- Minimum height: 24px. Below that, drop the wordmark and use the glyph only.
- Clear-space: at least the height of the "R" on every side.
- Never apply drop shadows, gradients other than the approved teal→signal-blue
  gradient, or rotate the mark.

The wordmark is set in **IBM Plex Sans 600**, tracking `-0.01em`, with `.site`
in a muted weight (500) and 80% opacity to read as a domain, not a slogan.

---

## 3. Typography System

| Role                | Family                                 | Weight | Notes                                   |
| ------------------- | -------------------------------------- | ------ | --------------------------------------- |
| Display / headings  | IBM Plex Sans                          | 600    | Institutional, geometric, neutral       |
| Body / UI           | IBM Plex Sans                          | 400/500| Falls back to Inter, then system        |
| Forensic data, IDs, hashes, addresses | JetBrains Mono | 400/500| Tabular, unambiguous 0/O, l/1           |

Scale (tailwind classes used in code):

| Token        | Class      | Use                              |
| ------------ | ---------- | -------------------------------- |
| Display XL   | `text-5xl` | Landing hero only                |
| Display L    | `text-4xl` | Section heroes                   |
| Heading      | `text-2xl` | Page titles                      |
| Subheading   | `text-lg`  | Card titles                      |
| Body         | `text-sm`  | Default UI text                  |
| Caption      | `text-xs`  | Metadata, labels                 |
| Forensic     | `font-mono text-xs` | Hashes, addresses, IDs   |

---

## 4. Trust Color Palette

All values live as CSS custom properties on `.refunds-scope` in `src/index.css`.

| Token              | HSL              | Role                                          |
| ------------------ | ---------------- | --------------------------------------------- |
| Vault (background) | `220 60% 5%`     | Page background — deep graphite-blue          |
| Surface (card)     | `222 45% 8%`     | Cards, panels                                 |
| Sidebar            | `222 60% 4%`     | Navigation chrome                             |
| Primary (cyber)    | `180 95% 50%`    | Primary actions, intelligence accents         |
| Accent (signal)    | `217 91% 60%`    | Secondary actions, links, info                |
| Success            | `152 70% 45%`    | Recovered / verified                          |
| Alert              | `38 95% 55%`     | Investigation, attention                      |
| Danger             | `0 84% 60%`      | Compromised, blocked                          |
| Foreground         | `195 25% 96%`    | Primary text                                  |
| Muted              | `215 15% 62%`    | Secondary text                                |

Usage rules:
- The page background is always Vault. Never invert.
- Primary is a state, not decoration — reserve it for the single most important
  action in any view.
- Alert / Danger pulse rings are reserved for live, time-sensitive states.

---

## 5. Glassmorphism Rules

Two surface tiers:

- `refunds-glass` — primary panels (vault overview cards, modals).
  `blur(14px) saturate(140%)`, 60–75% card opacity, 1px border at 70%.
- `refunds-glass-soft` — inline widgets layered over other panels.
  `blur(10px) saturate(130%)`, 25–55% opacity, subtler border.

Rules:
- Never nest more than two glass layers — readability degrades.
- Glass surfaces always sit on a `refunds-radial`, `refunds-vault-bg`, or
  `refunds-grid-bg` background; never on plain `bg-background`.
- Body text on glass must remain at least 14px / weight 400 for legibility.

---

## 6. Iconography

- Source: `lucide-react`. Stroke width 1.6–1.8.
- Vault / security icons: `ShieldCheck`, `Lock`, `KeyRound`, `Fingerprint`,
  `Eye`, `ScanLine`.
- Forensics / chain intel: `Network`, `GitBranch`, `Hash`, `Activity`,
  `Radar`, `LineChart`.
- Compliance: `FileCheck2`, `Gavel`, `Scale`.
- Avoid filled icons except inside primary buttons.

---

## 7. Motion Principles

Motion is **diagnostic, not decorative.**

- `refunds-scan-line` — sweep line on panels under live analysis. Slow (7s),
  low opacity, never on idle content.
- `refunds-pulse-ring` — soft teal pulse on the single most important live
  indicator (live status pip).
- `refunds-pulse-alert` — amber pulse only on items requiring human action.
- `refunds-vault-lock` — one-shot lift on the vault glyph during a successful
  authentication event.

All animations respect `prefers-reduced-motion: reduce`.

---

## 8. Compliance & Anti-Pattern Guardrails

The following are **prohibited** anywhere in Refunds.site copy or UI:

- "Guaranteed recovery", "100% success rate", "always", "instantly"
- Fake star ratings, fabricated client logos, made-up press mentions
- Countdown timers urging the user to act ("offer expires in…")
- Any wording implying we contact law enforcement on the user's behalf
  without their explicit, recorded consent
- Any wording implying we can reverse on-chain transactions ourselves

Approved framing examples:
- "We analyze on-chain activity to identify the path of stolen funds."
- "We coordinate with regulated exchanges and your counsel during
  authorized recovery actions."
- "Recovery outcomes depend on jurisdiction, counterparty cooperation,
  and the underlying asset."
