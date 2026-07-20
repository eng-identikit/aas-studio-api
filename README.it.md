<div align="center">

# AAS Studio API

**Backend REST di AAS Studio — autenticazione, persistenza e versionamento git-like degli Asset Administration Shell**

[![Node](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MariaDB](https://img.shields.io/badge/MariaDB-Sequelize-003545?logo=mariadb&logoColor=white)](https://mariadb.org)
[![Redis](https://img.shields.io/badge/Redis-ioredis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

[🇬🇧 English](README.md) · 🇮🇹 Italiano

</div>

---

## Ruolo in AAS Studio

Questo modulo è il **backend obbligatorio** del [frontend AAS Studio](https://github.com/eng-identikit/aas-studio-react/blob/main/README.md): login, sessioni e ogni operazione di editor, lifecycle e server della UI passano da questa API REST. Senza di esso il frontend non può funzionare correttamente.

| Modulo | Ruolo | Porta di default |
|---|---|---|
| [aas-studio-react](https://github.com/eng-identikit/aas-studio-react/blob/main/README.md) | Web IDE (frontend) | `5173` (dev) |
| **aas-studio-api** (questo repo) | Backend REST | `9010` |
| [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md) | Lancio server AAS di debug | `6790` / `6789` |

Fa inoltre da **gateway verso [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md)**: il frontend non parla mai direttamente col runner — le chiamate `/v1/runner/*` vengono inoltrate alla control API del runner (`AAS_RUNNER_URL`) per istanziare i server AAS di debug dall'interfaccia.

---

## Funzionalità

- **Autenticazione JWT** (access + refresh token) via Passport, con sessioni su Redis
- **Account** — Utenti, Operatori e Organizzazioni (Sequelize su MariaDB)
- **Persistenza AAS con versionamento git-like** — documenti, ref, commit, diff e snapshot
- **Catalogo IDTA** — submodel template scaricati dal repository ufficiale [admin-shell-io/submodel-templates](https://github.com/admin-shell-io/submodel-templates), con cache
- **Proxy runner** — start/stop/status/log del server AAS di debug tramite aas-server-runner
- **Server AAS remoti** — operazioni su server AAS esterni attivi (`/v1/aas-remote`)

---

## Requisiti

- Node.js ≥ 18
- **MariaDB** (account, documenti AAS, cronologia versioni)
- **Redis** (store sessioni / refresh token)
- [aas-server-runner](https://github.com/eng-identikit/aas-server-runner/blob/main/README.md) — solo per la funzione "Run Server"

---

## Configurazione

Crea un file `.env` nella root del progetto:

| Variabile | Esempio | Descrizione |
|---|---|---|
| `NODE_ENV` | `development` | `development` monta le route sotto `/api`; `production` le monta alla root |
| `PORT` | `9010` | Porta HTTP |
| `MARIADB_HOST` / `MARIADB_PORT` | `localhost` / `3306` | Connessione MariaDB |
| `MARIADB_DB` / `MARIADB_USER` / `MARIADB_PASS` | `AASStudio` / … | Database, utente, password |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / — | Connessione Redis |
| `JWT_AUTH_SECRET` / `JWT_REFRESH_SECRET` | — | Secret per access / refresh token |
| `GITHUB_TOKEN` | *(opzionale)* | Aumenta il rate limit GitHub per il catalogo IDTA (60 → 5000 req/h) |
| `AAS_RUNNER_URL` | `http://localhost:6790` | Control API di aas-server-runner |

---

## Avvio

```bash
npm install
npm run dev      # nodemon + dotenv, http://localhost:9010
```

In sviluppo tutte le route sono montate sotto il prefisso `/api` — il default del frontend è `VITE_API_URL=http://localhost:9010/api`.

---

## Superficie API

Tutte le route sono versionate sotto `/v1` (in dev: `http://localhost:9010/api/v1/…`).

| Route | Accesso | Scopo |
|---|---|---|
| `GET /v1/healthz` | pubblico | Health check |
| `/v1/auth/*` | pubblico | Login, refresh dei token |
| `/v1/session/*` | JWT | Gestione sessione |
| `GET /v1/idta/catalog` | JWT | Catalogo submodel template IDTA (con cache) |
| `/v1/aas/*` | account attivo | CRUD AAS + versionamento (ref, commit, diff, snapshot) |
| `/v1/aas-remote/*` | account attivo | Operazioni su server AAS remoti |
| `/v1/runner/*` | account attivo | Proxy verso la control API di aas-server-runner |

*"account attivo" = JWT valido **e** operatore + organizzazione in stato `activated`.*

**CORS** — sono ammesse solo le origin `http://localhost:5173` (dev server Vite) e `https://localhost`.

---

## Licenza

Distribuito sotto GNU General Public License v3.0. Vedi [LICENSE](LICENSE) per maggiori informazioni.
