# OrgMyMiam

PWA de planification de repas et liste de courses (fonctionne aussi hors ligne).

Monorepo npm workspaces :

- `apps/web` — Vite + React 19 + stockage local + PWA (Étapes 2–6)
- `apps/api` — API Fastify + MongoDB (auth JWT, catalogue, sync)
- `packages/shared` — types, normalisation des noms, schemas Zod

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
2. Vérifier l’accueil (prochains repas / accès courses).
3. Ajouter un produit ou une recette → visible immédiatement ; l’indicateur doit passer à « Enregistré » (ou « Sauvegarde… » puis « Enregistré »).
4. Dans DevTools → Network → **Offline**, ajouter encore des éléments : UI OK, indicateur « Hors ligne — sera sauvegardé plus tard » (ou « Hors ligne »).
5. Repasser online : sauvegarde automatique.
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
| `POST` | `/sync/push` | oui | Push mutations |
| `GET` | `/sync/pull?since=&deviceId=` | oui | Pull changements depuis cursor |

## Front (Étapes 2–6 + UX)

- Routing mobile + layout (bottom nav : Accueil, Produits, Recettes, Planning, Courses)
- Auth UI login/register
- Stockage local + file d’attente → sauvegarde serveur
- PWA installable
- Indicateur : « Enregistré », « Hors ligne — sera sauvegardé plus tard », « Sauvegarde… », « Erreur — réessayer »
- **Produits** : recherche + anti-doublons, sans jargon technique
- **Recettes / planning** : portions (« pour N personnes »), ingrédients avec sélecteur d’unités
- **Liste de courses** : génération depuis un planning (quantités adaptées aux portions), ajustement de quantité, extras, cochage hors ligne

### Tester l’anti-doublons produits

1. Se connecter.
2. Aller sur **Produits**, taper par ex. `LAIT DEMI-ECREME` ou `lait demi-écrémé` → suggestion + réutilisation.
3. Valider → pas de second produit.
4. Créer `Sauce Maison`, puis retaper `sauce  maison` / `SAUCE MAISON` → réutilise l’existant.
5. Hors ligne (DevTools Offline) : créer un produit inconnu → reste disponible localement, puis se sauvegarde au retour online.

### Tester recettes / planning

1. DevTools → Network → **Offline**.
2. **Recettes** → Nouvelle → titre, « pour combien de personnes », ingrédients (Quantité + Unité via sélecteur, ex. 400 g de pâtes) → Enregistrer.
3. **Planning** → Nouveau → ajouter des repas (date + type + recette, portions optionnelles) → Enregistrer.
4. Repasser online : sauvegarde ; recharger → données toujours là.

### Tester liste de courses

1. Avoir un planning avec recettes + ingrédients.
2. **Courses** → choisir le planning → lire l’aide portions → **Générer la liste**.
3. Ajuster une quantité via **Qté** sur une ligne ; ajouter un produit (ex. `éponge`).
4. DevTools Offline → cocher/décocher → indicateur hors ligne ; online → « Sauvegarde… » puis « Enregistré ».

### Smoke E2E offline → online

1. Online : créer produit + recette + planning, générer une liste de courses.
2. DevTools → **Offline**.
3. Cocher/décocher plusieurs articles ; éventuellement ajouter un produit ; modifier une quantité.
4. Vérifier l’indicateur « Hors ligne — sera sauvegardé plus tard » (ou « Hors ligne »).
5. Repasser **Online** : « Sauvegarde… » puis « Enregistré » ; cochages et quantités conservés.
6. Recharger la page : état inchangé.

Hors MVP : partage multi-user / temps réel (Étape 7 du plan).

## Roadmap

MVP offline couvert jusqu’à l’Étape 6 + passe UX copy/unités. Suite possible : **Étape 7** — préparation partage 2 users.
