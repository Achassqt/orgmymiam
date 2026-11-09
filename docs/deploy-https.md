# Déployer en HTTPS

OrgMyMiam = **MongoDB** + **API Fastify** + **front Vite** (nginx sert le build et reverse-proxy `/api`).

Le `docker-compose.yml` du dépôt suffit pour un stack local / VPS. Pour HTTPS public, choisir une des options ci-dessous (aucune clé cloud n’est fournie ici).

## Prérequis communs

1. Secrets JWT forts (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, ≥ 32 caractères aléatoires).
2. `CORS_ORIGIN` = URL HTTPS exacte du front (ex. `https://orgmymiam.example.com`).
3. Ne pas exposer Mongo sur Internet (retirer le mapping `MONGO_PORT` ou firewall).
4. Le front appelle `/api/*` en same-origin : derrière un reverse-proxy unique, pas besoin d’URL API séparée.

## Option A — Fly.io

- Créer 3 apps (ou Machines) : `mongo` (ou **MongoDB Atlas** / Fly Postgres n’est pas un drop-in — préférer **Atlas** ou un volume Mongo), `api`, `web`.
- Plus simple : **MongoDB Atlas** (URI TLS) + 2 apps Fly :
  - `api` : build `apps/api/Dockerfile`, secrets via `fly secrets set`, health `/health`.
  - `web` : build `apps/web/nginx` **ou** servir le dist via un reverse-proxy Fly qui route `/api` → app API.
- HTTPS : certificat Let’s Encrypt automatique sur `*.fly.dev` / domaine custom.
- Doc : [fly.io/docs](https://fly.io/docs/).

Exemple variables API :

```bash
fly secrets set \
  MONGODB_URI='mongodb+srv://…' \
  JWT_ACCESS_SECRET='…' \
  JWT_REFRESH_SECRET='…' \
  CORS_ORIGIN='https://votre-app.fly.dev' \
  NODE_ENV=production
```

Adapter `nginx.conf` / routing Fly pour que `/api/` atteigne l’app API (même host recommandé).

## Option B — Render

- **Web Service** API : Dockerfile `apps/api/Dockerfile`, health check `/health`.
- **Static Site** ou **Web Service** nginx pour le front ; ou un seul service nginx + API séparée.
- **Mongo** : Render n’offre pas Mongo managé → **Atlas** (ou conteneur privé).
- HTTPS inclus sur `*.onrender.com` + domaine custom.
- Définir `CORS_ORIGIN` sur l’URL Render du front.
- Doc : [render.com/docs](https://render.com/docs).

Astuce same-origin : un **Blueprint** avec un reverse-proxy (nginx) qui sert le dist et proxy `/api` vers le service API privé.

## Option C — VPS (Docker + Caddy / Traefik)

Sur un VPS (Hetzner, OVH, DigitalOcean…) :

```bash
git clone https://github.com/Achassqt/orgmymiam.git
cd orgmymiam
cp .env.example .env
# Éditer secrets + CORS_ORIGIN=https://votre-domaine.tld
docker compose up -d --build
```

Puis HTTPS avec **Caddy** (auto Let’s Encrypt) devant le port `WEB_PORT` (8080) :

```caddy
votre-domaine.tld {
  reverse_proxy 127.0.0.1:8080
}
```

Ou **Traefik** / **nginx** + certbot. Firewall : ouvrir 80/443 uniquement ; Mongo reste sur le réseau Docker.

## Checklist post-déploiement

- [ ] `GET https://…/api/health` (via nginx) ou `https://api…/health` → OK
- [ ] Inscription / login depuis le front HTTPS
- [ ] PWA installable (HTTPS obligatoire hors localhost)
- [ ] Secrets hors git ; backups volume Mongo ou Atlas
