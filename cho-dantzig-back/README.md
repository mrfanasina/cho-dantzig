# Cho-Dantzig Backend

Backend API pour l'algorithme de Dantzig - Résolution de problème du plus court et plus long chemin.

## 📁 Structure du Projet

```
cho-dantzig-back/
├── controllers/
│   ├── graphController.js      # Contrôleur pour la gestion des graphes
│   └── dantzigController.js    # Contrôleur pour l'algorithme et simulations
├── routes/
│   ├── graphRoutes.js           # Routes pour les graphes
│   └── dantzigRoutes.js         # Routes pour Dantzig et simulations
├── services/
│   └── dantzigService.js        # Implémentation de l'algorithme de Dantzig
├── models/
│   ├── Graph.js                  # Modèle pour les graphes (stockage en mémoire)
│   └── Simulation.js             # Modèle pour les simulations
├── middlewares/
│   └── errorHandler.js           # Gestion globale des erreurs
├── utils/
│   └── validators.js             # Fonctions de validation
├── server.js                      # Fichier principal du serveur
├── package.json
└── README.md
```

## 🚀 Installation et Lancement

### Prérequis
- Node.js (version 14 ou supérieure)
- npm ou yarn

### Étapes d'installation

1. Aller dans le répertoire du backend :
```bash
cd cho-dantzig-back
```

2. Installer les dépendances :
```bash
npm install
```

3. Lancer le serveur :
   - En mode production :
   ```bash
   npm start
   ```
   
   - En mode développement (avec nodemon pour le rechargement automatique) :
   ```bash
   npm run dev
   ```

Le serveur démarre sur le port 3001 par défaut.

## 🔌 Points de terminaison de l'API

### 1. Santé
- `GET /api/health` - Vérifie si l'API fonctionne

### 2. Gestion des Graphes
- `POST /api/graphs` - Créer un nouveau graphe
- `GET /api/graphs` - Récupérer tous les graphes
- `GET /api/graphs/:id` - Récupérer un graphe par son ID
- `DELETE /api/graphs/:id` - Supprimer un graphe

### 3. Algorithme de Dantzig
- `POST /api/dantzig/run` - Exécuter l'algorithme de Dantzig
- `POST /api/dantzig/simulations` - Sauvegarder une simulation
- `GET /api/dantzig/simulations` - Récupérer toutes les simulations
- `GET /api/dantzig/simulations/:id` - Récupérer une simulation par son ID

## 📊 Exemples d'Utilisation

### Exemple 1: Créer un graphe
```bash
curl -X POST http://localhost:3001/api/graphs \\
  -H "Content-Type: application/json" \\
  -d '{
    "nodes": ["A", "B", "C", "D"],
    "edges": [
      { "from": "A", "to": "B", "weight": 4 },
      { "from": "A", "to": "C", "weight": 2 },
      { "from": "B", "to": "D", "weight": 3 },
      { "from": "C", "to": "D", "weight": 1 }
    ]
  }'
```

### Exemple 2: Exécuter l'algorithme de Dantzig (Minimisation)
```bash
curl -X POST http://localhost:3001/api/dantzig/run \\
  -H "Content-Type: application/json" \\
  -d '{
    "graph": {
      "nodes": ["A", "B", "C", "D"],
      "edges": [
        { "from": "A", "to": "B", "weight": 4 },
        { "from": "A", "to": "C", "weight": 2 },
        { "from": "B", "to": "D", "weight": 3 },
        { "from": "C", "to": "D", "weight": 1 }
      ]
    },
    "optimizationType": "min"
  }'
```

## 🧠 Algorithme de Dantzig - Explication

### Principe
L'algorithme de Dantzig, aussi connu sous le nom d'algorithme Floyd-Warshall, permet de trouver les plus courts chemins entre toutes les paires de sommets dans un graphe pondéré.

### Fonctionnalités Implémentées
- **Minimisation** : Trouve le plus court chemin (par défaut)
- **Maximisation** : Trouve le plus long chemin (pour les graphes acycliques)
- **Détection de cycles négatifs**
- **Suivi étape par étape** : Retourne toutes les matrices intermédiaires
- **Reconstruction des chemins** : Fournit les chemins optimaux entre chaque paire de nœuds

### Complexité
- Temps : O(n³) où n est le nombre de nœuds
- Espace : O(n²) pour stocker les matrices de distances

## 🛡️ Validation et Gestion d'Erreurs

L'API inclut :
- Validation complète des graphes avant traitement
- Vérification des cycles négatifs
- Gestion globale des erreurs avec messages clairs
- Réponses JSON cohérentes avec indicateurs de succès/échec

## 📝 Technologies Utilisées

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **CORS** - Gestion des requêtes cross-origin
- **UUID** - Génération d'identifiants uniques
- **Nodemon** - Rechargement automatique en développement
- **Jest** - Framework de tests (optionnel)
