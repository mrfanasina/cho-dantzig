const Graph = require('../models/Graph');
const { validateGraph } = require('../utils/validators');

const graphController = {
  async create(req, res, next) {
    try {
      const validation = validateGraph(req.body);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation du graphe',
          errors: validation.errors
        });
      }

      const graph = Graph.create(req.body);
      
      res.status(201).json({
        success: true,
        data: graph
      });
    } catch (error) {
      next(error);
    }
  },

  async findAll(req, res, next) {
    try {
      const graphs = Graph.findAll();
      
      res.json({
        success: true,
        data: graphs,
        count: graphs.length
      });
    } catch (error) {
      next(error);
    }
  },

  async findById(req, res, next) {
    try {
      const { id } = req.params;
      const graph = Graph.findById(id);
      
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: `Graphe avec l'ID ${id} non trouvé`
        });
      }

      res.json({
        success: true,
        data: graph
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = Graph.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Graphe avec l'ID ${id} non trouvé`
        });
      }

      res.json({
        success: true,
        message: `Graphe avec l'ID ${id} supprimé avec succès`
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = graphController;
