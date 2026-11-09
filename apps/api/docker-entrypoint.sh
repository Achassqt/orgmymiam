#!/bin/sh
set -e

# Seed catalogue socle (idempotent pour la version CATALOG_VERSION)
if [ "${SKIP_SEED:-0}" != "1" ]; then
  echo "Seed catalogue…"
  node dist/scripts/seed-catalog.js
fi

exec "$@"
