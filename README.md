# OrgMyMiam

PWA Offline-First de planification de repas et liste de courses.

Monorepo npm workspaces :

- `apps/web` — Vite + React 19 + Dexie + PWA (Étapes 2–6, offline durci)
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
npm run build:shared
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

## Lancer le web (PWA)

```bash
npm run dev:web
```

Ouvre [http://localhost:5173](http://localhost:5173). Les appels `/api/*` sont proxifiés vers l’API.

### Tester le mode offline

1. Créer un compte / se connecter (nécessite l’API online une première fois).
2. Vérifier que le catalogue se charge (accueil).
3. Ajouter un produit ou une recette → visible immédiatement (Dexie) ; l’indicateur de sync doit remonter l’outbox puis repasser « À jour ».
4. Dans DevTools → Network → **Offline**, ajouter encore des éléments : UI OK, outbox > 0, indicateur « Hors ligne ».
5. Repasser online : flush `POST /sync/push` + pull automatique.
6. Build installable : `npm run build -w @orgmymiam/web && npm run preview -w @orgmymiam/web` puis « Installer l’app » (manifest + service worker).

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

## Front (Étapes 2–6)

- Routing mobile + layout (bottom nav)
- Auth UI login/register branchée API
- Dexie : `meta`, `catalogProducts`, `products`, `recipes`, `mealPlans`, `shoppingLists`, `outbox`
- CRUD local optimiste + outbox → sync push/pull
- `vite-plugin-pwa` (precache shell, navigation fallback, API network-only)
- Indicateur online / offline / sync
- **Produits** : autocomplete sur `catalogProducts ∪ products` via `normalizeProductName` (anti-doublons accents/casse)
- **Recettes / plans** : CRUD offline avec ingrédients (autocomplete) et slots (date + mealType + recipeId)
- **Liste de courses** : génération consolidée depuis un plan, extras, cochage offline, regroupement par catégorie
- **Sync durcie** : indicateur hors ligne / sync / à jour / erreur, retry outbox (backoff), LWW client (items liste), reprise online/focus

### Tester l’anti-doublons produits

1. Se connecter (catalogue syncé localement).
2. Aller sur **Produits**, taper par ex. `LAIT DEMI-ECREME` ou `lait demi-écrémé` → suggestion catalogue + match exact.
3. Valider → adoption / réutilisation, **pas** de second produit.
4. Créer `Sauce Maison`, puis retaper `sauce  maison` / `SAUCE MAISON` → réutilise l’existant.
5. Hors ligne (DevTools Offline) : créer un produit inconnu → UUID local + outbox.

### Tester recettes / plans offline

1. DevTools → Network → **Offline**.
2. **Recettes** → Nouvelle → titre, portions, ajouter ingrédients via autocomplete (ex. `pâtes`, `oeufs`), notes → Enregistrer.
3. **Plans** → Nouveau → ajouter des créneaux (date + type + recette) → Enregistrer.
4. Repasser online : outbox flush + sync ; recharger → données toujours là.

### Tester liste de courses

1. Avoir un plan avec recettes + ingrédients.
2. **Courses** → choisir le plan → **Générer la liste** (quantités × servings / override, consolidées productId+unit).
3. Ajouter un extra (ex. `éponge`) via autocomplete.
4. DevTools Offline → cocher/décocher → outbox ; online → sync.

### Smoke E2E offline → online (Étape 6)

1. Online : créer produit + recette + plan, générer une liste de courses.
2. DevTools → **Offline**.
3. Cocher/décocher plusieurs articles ; éventuellement ajouter un extra.
4. Vérifier l’indicateur « Hors ligne · N en attente ».
5. Repasser **Online** : « Sync en cours… » puis « À jour » ; cochages conservés ; outbox vide.
6. Recharger la page : état inchangé (Dexie + sync).

Hors MVP : partage multi-user / temps réel (Étape 7 du plan).

## Roadmap

MVP offline-first couvert jusqu’à l’Étape 6. Suite possible : **Étape 7** — préparation partage 2 users.
