# 🔍 Cho-Dantzig — Simulation du chemin optimal

<div align="center">

  <p>Simulation interactive du chemin de valeur optimale basée sur l'algorithme de Dantzig</p>

  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
  ![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
  ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

  ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
  ![Status](https://img.shields.io/badge/statut-en%20développement-yellow?style=flat-square)

</div>

---

## 📖 Description

**Cho-Dantzig** est une application web interactive qui simule le **chemin de valeur optimale** à l'aide de l'algorithme de Dantzig. Ce projet vise à illustrer des concepts fondamentaux de la **recherche opérationnelle** et de l'**optimisation de graphes**, en rendant ces notions accessibles et visuelles pour les étudiants et les praticiens.

---

## 🛠️ Stack Technique

| Couche | Technologie |
|---|---|
| Frontend | React + TypeScript |
| Styles | TailwindCSS |
| Backend *(prévu)* | Express.js (Node.js) |
| Gestionnaire de paquets | npm |

---

## ✨ Fonctionnalités

- 🗺️ **Visualisation de graphes** — Représentation graphique interactive des nœuds et des arêtes
- ⚡ **Calcul du chemin optimal** — Application pas-à-pas de l'algorithme de Dantzig
- 🎮 **Interface interactive** — Saisie manuelle des graphes et des pondérations
- 📊 **Affichage de la matrice de distances** — Suivi visuel de l'évolution des matrices durant l'exécution
- 🔄 **Réinitialisation et rejeu** — Possibilité de rejouer la simulation depuis le début
- 🌐 **Backend prévu** — API Express.js pour le traitement côté serveur et la persistance des données


---

## 🚀 Installation

### Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- [npm](https://www.npmjs.com/) v9 ou supérieur

### Étapes

1. **Cloner le dépôt**

```bash
git clone https://github.com/mrfanasina/cho-dantzig.git
cd cho-dantzig
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Lancer le serveur de développement**

```bash
npm run dev
```

4. **Ouvrir dans le navigateur**

```
http://localhost:5173
```

---

## 💡 Utilisation

1. **Définir le graphe** — Entrez les nœuds et les arêtes avec leurs pondérations via l'interface
2. **Lancer la simulation** — Cliquez sur *"Calculer"* pour démarrer l'algorithme de Dantzig
3. **Observer les étapes** — Suivez l'évolution de la matrice de distances à chaque itération
4. **Interpréter le résultat** — Le chemin optimal est mis en évidence à la fin de l'exécution
5. **Réinitialiser** — Utilisez le bouton *"Réinitialiser"* pour recommencer avec un nouveau graphe

---

## 🧠 Concepts Utilisés

### Algorithme de Dantzig

L'algorithme de Dantzig est une méthode d'optimisation pour trouver le **plus court chemin entre toutes les paires de nœuds** dans un graphe pondéré. Il repose sur le principe de **programmation dynamique** :

```
D[i][j] = min(D[i][j], D[i][k] + D[k][j])
```

pour chaque nœud intermédiaire `k`.

### Notions clés

- **Graphe orienté / non orienté** — Modélisation des relations entre nœuds
- **Matrice d'adjacence** — Représentation matricielle des distances initiales
- **Relaxation des arêtes** — Mise à jour itérative des chemins optimaux
- **Recherche opérationnelle** — Discipline visant à optimiser des systèmes complexes

---

## 👤 Auteur

**mrfanasina**

- GitHub : [@mrfanasina](https://github.com/mrfanasina)

---

## 📄 Licence

Ce projet est distribué sous licence **MIT**.
Voir le fichier [LICENSE](./LICENSE) pour plus de détails.

---

<div align="center">
  <sub>Fait avec ❤️ pour la recherche opérationnelle et l'optimisation de graphes</sub>
</div>
