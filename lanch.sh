#!/bin/bash

# =====================================
# - Script de lancement pour linux
# =====================================

APP_DIR="/home/fa/development/RO_M1/cho-dantzig"
BACKEND_DIR="$APP_DIR/cho-dantzig-back"
FRONTEND_DIR="$APP_DIR/cho-dantzig-front"

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
RESET="\e[0m"

echo -e "${CYAN}Lancement du projet...${RESET}"


cd "$BACKEND_DIR" || { 
  echo -e "${RED}Backend introuvable${RESET}"
  exit 1
}


# =====================================
# === DÉMARRAGE BACKEND ===
# =====================================

echo -e "${YELLOW}Démarrage du backend avec flags : $* ${RESET}"
npm run dev &
BACK_PID=$!

# =====================================
# === FRONTEND ===
# =====================================

cd "$FRONTEND_DIR" || { 
  echo -e "${RED}Frontend introuvable${RESET}"
  kill $BACK_PID 2>/dev/null
  exit 1
}

echo -e "${YELLOW}Attente du backend...${RESET}"
BACKEND_URL="http://127.0.0.1:3001"

until curl -s "$BACKEND_URL" > /dev/null; do
  sleep 1
done

echo -e "${GREEN}Backend opérationnel${RESET}"

if [ "$BUILD_FRONTEND" = true ]; then
  echo -e "${YELLOW}Build frontend (prod)...${RESET}"
  npm run build
  echo -e "${YELLOW}Frontend prod : http://localhost:3000${RESET}"
  npx serve -s build -l 3000 &
else
  echo -e "${YELLOW}Frontend dev (npm run dev)...${RESET}"
  npm run dev &
fi

FRONT_PID=$!

echo -e "${GREEN}Backend et frontend prêts !${RESET}"

# =====================================
# === FERMETURE PROPRE ===
# =====================================

trap "echo -e '${RED}Arrêt du projet...${RESET}'; kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
