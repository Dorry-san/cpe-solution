#!/usr/bin/env bash

set -euo pipefail

confirmed=false
for argument in "$@"; do
  case "$argument" in
    --yes|-y) confirmed=true ;;
    *) echo "Option inconnue : $argument" >&2; exit 1 ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
seed_file="$script_dir/seed-demo.mjs"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker n'est pas installé ou inaccessible." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "Docker Compose est introuvable." >&2
  exit 1
fi

echo "ATTENTION : ce script supprime toutes les données applicatives et tous les CV."
echo "Il recrée ensuite 1 entreprise, 2 offres et 6 candidatures."
if [ "$confirmed" = false ]; then
  read -r -p "Tapez OUI pour continuer : " answer
  if [ "$answer" != "OUI" ]; then
    echo "Opération annulée."
    exit 1
  fi
fi

"${compose[@]}" exec -T web node --input-type=module < "$seed_file"
