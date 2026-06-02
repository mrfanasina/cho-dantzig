const { v4: uuidv4 } = require('uuid');

let simulations = [];

class Simulation {
  constructor(data) {
    this.id = uuidv4();
    this.graphId = data.graphId || null;
    this.graph = data.graph;
    this.optimizationType = data.optimizationType;
    this.results = data.results;
    this.createdAt = new Date().toISOString();
  }

  static create(data) {
    const simulation = new Simulation(data);
    simulations.push(simulation);
    return simulation;
  }

  static findById(id) {
    return simulations.find(simulation => simulation.id === id);
  }

  static findAll() {
    return simulations;
  }
}

module.exports = Simulation;
