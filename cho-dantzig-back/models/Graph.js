const { v4: uuidv4 } = require('uuid');

let graphs = [];

class Graph {
  constructor(data) {
    this.id = uuidv4();
    this.nodes = data.nodes;
    this.edges = data.edges;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  static create(data) {
    const graph = new Graph(data);
    graphs.push(graph);
    return graph;
  }

  static findAll() {
    return graphs;
  }

  static findById(id) {
    return graphs.find(graph => graph.id === id);
  }

  static delete(id) {
    const index = graphs.findIndex(graph => graph.id === id);
    if (index !== -1) {
      graphs.splice(index, 1);
      return true;
    }
    return false;
  }
}

module.exports = Graph;
