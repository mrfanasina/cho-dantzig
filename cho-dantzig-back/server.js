const express = require('express');
const cors = require('cors');
const errorHandler = require('./middlewares/errorHandler');

const graphRoutes = require('./routes/graphRoutes');
const dantzigRoutes = require('./routes/dantzigRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API de l\'algorithme de Dantzig fonctionnelle',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/graphs', graphRoutes);
app.use('/api/dantzig', dantzigRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} non trouvée`
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                                ║
║       🔢 Algorithme de Dantzig - Backend API                 ║
║                                                                ║
║       Serveur démarré avec succès !                           ║
║       Port: ${PORT}                                                ║
║       URL: http://localhost:${PORT}                               ║
║                                                                ║
║       Points de terminaison disponibles:                      ║
║       GET  /api/health                   - Santé API         ║
║                                                                ║
║       POST /api/graphs                  - Créer graphe       ║
║       GET  /api/graphs                  - Récupérer graphes  ║
║       GET  /api/graphs/:id              - Récupérer graphe   ║
║       DELETE /api/graphs/:id            - Supprimer graphe   ║
║                                                                ║
║       POST /api/dantzig/run             - Exécuter Dantzig   ║
║       POST /api/dantzig/simulations     - Sauvegarder sim    ║
║       GET  /api/dantzig/simulations     - Récupérer sims     ║
║       GET  /api/dantzig/simulations/:id - Récupérer sim      ║
║                                                                ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
