# Treasury Vault Deployment

## Services

1. API Server
   Source: artifacts/api-server
   Build: pnpm run build
   Start: pnpm run start
   Runtime: Node.js 24

2. Crypto Dashboard
   Source: artifacts/crypto-dashboard
   Build: pnpm run build
   Output: dist

3. Admin Dashboard
   Source: artifacts/admin-dashboard
   Build: pnpm run build
   Output: dist

## Required production configuration

- DATABASE_URL
- NODE_ENV=production
- PORT (assigned by hosting provider)
- BASE_PATH (as required by Vite configuration)
- Authentication and session secrets
- Allowed frontend origins
- HTTPS and verified PostgreSQL TLS

## Launch requirements

- Use the existing PostgreSQL database
- Configure production environment secrets
- Connect frontend to the production API
- Configure HTTPS and custom domains
- Complete final security and functional testing
- Do not activate placeholder payment wallets
