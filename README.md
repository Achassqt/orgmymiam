# OrgMyMiam

PWA Offline-First de planification de repas et liste de courses.

Monorepo npm workspaces :

- `apps/web` — frontend Vite + React (stub pour l’instant ; PWA Dexie à l’Étape 2)
- `apps/api` — API Fastify + MongoDB (auth JWT, catalogue, sync LWW)
- `packages/shared` — types, `normalizeProductName`, schemas Zod

## Prérequis

- **Node.js** ≥ 20
- **MongoDB** ≥ 6 (local ou URI distante)
- npm 10+

## Setup local

```bash
git clone https://github.com/Achassqt/orgmymiam.git
cd orgmymiam
npm install
cp .env.example apps/api/.env
# Éditer apps/api/.env si besoin (URI Mongo, secrets JWT)
```

### Variables d’environnement

Voir `.env.example` et `apps/api/.env.example` :

| Variable | Description | Défaut |
| --- | --- | --- |
| `MONGODB_URI` | URI MongoDB | `mongodb://127.0.0.1:27017/orgmymiam` |
| `JWT_ACCESS_SECRET` | Secret JWT access | (dev placeholder) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh | (dev placeholder) |
| `JWT_ACCESS_EXPIRES_IN` | Durée access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Durée refresh token | `30d` |
| `API_HOST` / `API_PORT` | Bind API | `0.0.0.0` / `3001` |
| `CORS_ORIGIN` | Origine CORS front | `http://localhost:5173` |
| `CATALOG_VERSION` | Version du catalogue seed | `1` |

Ne committez jamais de fichiers `.env` ni de secrets.

## Lancer l’API + seed

1. Démarrer MongoDB localement (`mongod` ou Docker) :

```bash
docker run -d --name orgmymiam-mongo -p 27017:27017 mongo:7
```

2. Seed du catalogue socle (~120 produits FR) :

```bash
npm run seed
```

3. API en watch :

```bash
npm run dev:api
```

Health check : [http://127.0.0.1:3001/health](http://127.0.0.1:3001/health)

## Lancer le web (stub)

```bash
npm run dev:web
```

Ouvre [http://localhost:5173](http://localhost:5173). Les appels `/api/*` sont proxifiés vers l’API.

## Scripts utiles

| Script | Action |
| --- | --- |
| `npm run build` | Build shared → api → web |
| `npm run typecheck` | Typecheck tous les packages |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run seed` | Seed `catalog_products` |

## API (Étape 1)

| Méthode | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | non | Santé service + Mongo |
| `POST` | `/auth/register` | non | Inscription email/password |
| `POST` | `/auth/login` | non | Login → access + refresh JWT |
| `POST` | `/auth/refresh` | non | Rotation refresh token |
| `GET` | `/catalog?sinceVersion=` | oui | Catalogue socle |
| `POST` | `/sync/push` | oui | Push mutations (LWW + tombstones) |
| `GET` | `/sync/pull?since=&deviceId=` | oui | Pull changements depuis cursor |

Les documents sync utilisent des **UUID v4 string** comme `_id` (pas d’ObjectId Mongo).

## Roadmap

Voir le plan d’architecture du projet. Prochaine livrable : **Étape 2** — PWA + Dexie + outbox.
