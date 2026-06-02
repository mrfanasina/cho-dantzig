const dantzigService = require('../services/dantzigService');
const { validateGraph } = require('../utils/validators');
const Simulation = require('../models/Simulation');

const dantzigController = {
  async run(req, res, next) {
    try {
      const { graph, sourceNode, optimizationType = 'min' } = req.body;

      const validation = validateGraph(graph);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation du graphe',
          errors: validation.errors
        });
      }

      const results = dantzigService.executeDantzig(graph, sourceNode, optimizationType);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      next(error);
    }
  },

  async saveSimulation(req, res, next) {
    try {
      const { graph, results, graphId } = req.body;

      if (!graph || !results) {
        return res.status(400).json({
          success: false,
          message: 'Le graphe et les résultats sont requis pour sauvegarder une simulation'
        });
      }

      const simulation = Simulation.create({
        graphId,
        graph,
        results
      });

      res.status(201).json({
        success: true,
        data: simulation
      });
    } catch (error) {
      next(error);
    }
  },

  async getSimulation(req, res, next) {
    try {
      const { id } = req.params;
      const simulation = Simulation.findById(id);

      if (!simulation) {
        return res.status(404).json({
          success: false,
          message: `Simulation avec l'ID ${id} non trouvée`
        });
      }

      res.json({
        success: true,
        data: simulation
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllSimulations(req, res, next) {
    try {
      const simulations = Simulation.findAll();

      res.json({
        success: true,
        data: simulations,
        count: simulations.length
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = dantzigController;
