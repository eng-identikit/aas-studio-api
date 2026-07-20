<div align="center">

# AAS Studio API

**REST backend of AAS Studio — authentication, persistence, and git-like versioning of Asset Administration Shells**

[![Node](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MariaDB](https://img.shields.io/badge/MariaDB-Sequelize-003545?logo=mariadb&logoColor=white)](https://mariadb.org)
[![Redis](https://img.shields.io/badge/Redis-ioredis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

🇬🇧 English · [🇮🇹 Italiano](README.it.md)

</div>

---

## Role in AAS Studio

This module is the **mandatory backend** of the [AAS Studio frontend](https://github.com/eng-identikit/aas-studio-react/blob/main/README.md): sign-in, sessions, and every editor, lifecycle, and server operation of the UI go through this REST API. The frontend cannot run properly without it.

| Module | Role | Default port |
|---|---|---|
| [aas-studio-react](https://github.com/eng-identikit/aas-studio-react/blob/main/README.md) | Web IDE (frontend) | `5173` (dev) |
| **aas-studio-api** (this repo) | REST backend | `9010` |
| [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md) | Debug AAS server launcher | `6790` / `6789` |

It also acts as the **gateway to [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md)**: the frontend never talks to the runner directly — `/v1/runner/*` calls are proxied to the runner's control API (`AAS_RUNNER_URL`) to instantiate debug AAS servers from the interface.

---

## Features

- **JWT authentication** (access + refresh tokens) via Passport, with Redis-backed sessions
- **Accounts** — Users, Operators, and Organizations (Sequelize on MariaDB)
- **AAS persistence with git-like versioning** — documents, refs, commits, diffs, and snapshots
- **IDTA catalog** — submodel templates fetched from the official [admin-shell-io/submodel-templates](https://github.com/admin-shell-io/submodel-templates) repository, with caching
- **Runner proxy** — start/stop/status/logs of the debug AAS server via aas-server-runner
- **Remote AAS servers** — operations on external, live AAS servers (`/v1/aas-remote`)

---

## Requirements

- Node.js ≥ 18
- **MariaDB** (accounts, AAS documents, version history)
- **Redis** (session / refresh-token store)
- [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md) — only for the "Run Server" feature

---

## Configuration

Create a `.env` file in the project root:

| Variable | Example | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` mounts routes under `/api`; `production` mounts them at root |
| `PORT` | `9010` | HTTP port |
| `MARIADB_HOST` / `MARIADB_PORT` | `localhost` / `3306` | MariaDB connection |
| `MARIADB_DB` / `MARIADB_USER` / `MARIADB_PASS` | `AASStudio` / … | Database, user, password |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / — | Redis connection |
| `JWT_AUTH_SECRET` / `JWT_REFRESH_SECRET` | — | Secrets for access / refresh tokens |
| `GITHUB_TOKEN` | *(optional)* | Raises the GitHub rate limit for the IDTA catalog (60 → 5000 req/h) |
| `AAS_RUNNER_URL` | `http://localhost:6790` | aas-server-runner control API |

---

## Getting Started

```bash
npm install
npm run dev      # nodemon + dotenv, http://localhost:9010
```

In development all routes are mounted under the `/api` prefix — the frontend default is `VITE_API_URL=http://localhost:9010/api`.

---

## API Surface

All routes are versioned under `/v1` (in dev: `http://localhost:9010/api/v1/…`).

| Route | Access | Purpose |
|---|---|---|
| `GET /v1/healthz` | public | Health check |
| `/v1/auth/*` | public | Sign-in, token refresh |
| `/v1/session/*` | JWT | Session management |
| `GET /v1/idta/catalog` | JWT | IDTA submodel-template catalog (cached) |
| `/v1/aas/*` | active account | AAS CRUD + versioning (refs, commits, diffs, snapshots) |
| `/v1/aas-remote/*` | active account | Operations on remote AAS servers |
| `/v1/runner/*` | active account | Proxy to the aas-server-runner control API |

*"active account" = valid JWT **and** operator + organization in `activated` state.*

**CORS** — only `http://localhost:5173` (Vite dev server) and `https://localhost` are allowed origins.

---

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for more information.
