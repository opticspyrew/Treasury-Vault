---
name: workflow port conflicts (orphaned vite/dev procs)
description: Why a vite/web workflow shows FAILED/DIDNT_OPEN_A_PORT yet is actually serving, and how to fix it.
---

# Orphaned dev processes hold artifact ports → false "FAILED" workflow status

Symptom: restarting a web workflow fails with `DIDNT_OPEN_A_PORT` (e.g. "didn't open
port 20512"), but the workflow log shows vite is "ready" on the *next* port
(20513), and the app actually serves fine.

**Why:** each artifact is assigned a fixed PORT. Vite, when its assigned port is
already taken, silently falls back to PORT+1 instead of failing. The workflow
health check only watches the assigned port, so it reports FAILED even though vite
is up. The port is held by an **orphaned** vite/pnpm-dev process from a previous
session that `restart_workflow` does NOT track and therefore cannot reap (it only
SIGTERM/SIGKILLs the process group it spawned).

**How to apply:** don't keep retrying `restart_workflow` — it can't kill orphans.
`lsof`/`ss` often can't see the listener in this sandbox, so don't rely on them.
Instead kill the stale dev processes directly, then restart:

```
pkill -9 -f "vite.js"; pkill -9 -f "vite dev"; pkill -9 -f "vite --config"
pkill -9 -f "filter @workspace/<artifact> run dev"
```

(The pkill may kill its own shell → exit 137; that's fine, the kills still land.)
Then `restart_workflow` each web workflow; they grab the correct assigned ports.

Note: api-server (`node ./dist/index.mjs`, port 8080) binds hard and EADDRINUSEs
rather than falling back — same root cause (orphan), same fix.
