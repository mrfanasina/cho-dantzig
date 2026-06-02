function validateGraph(graph) {
  const errors = [];

  if (!graph) {
    errors.push('Le graphe est manquant');
    return { isValid: false, errors };
  }

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    errors.push('Les nœuds (nodes) sont manquants ou invalides');
  } else if (graph.nodes.length === 0) {
    errors.push('Le graphe doit contenir au moins un nœud');
  }

  if (!graph.edges || !Array.isArray(graph.edges)) {
    errors.push('Les arêtes (edges) sont manquantes ou invalides');
  } else {
    graph.edges.forEach((edge, index) => {
      if (!edge.from) {
        errors.push(`L'arête ${index + 1} ne spécifie pas de nœud de départ (from)`);
      }
      if (!edge.to) {
        errors.push(`L'arête ${index + 1} ne spécifie pas de nœud d'arrivée (to)`);
      }
      if (typeof edge.weight !== 'number') {
        errors.push(`L'arête ${index + 1} a un poids invalide`);
      }
    });
  }

  if (graph.nodes && graph.edges) {
    const nodeSet = new Set(graph.nodes);
    graph.edges.forEach((edge, index) => {
      if (edge.from && !nodeSet.has(edge.from)) {
        errors.push(`L'arête ${index + 1} référence un nœud inconnu : ${edge.from}`);
      }
      if (edge.to && !nodeSet.has(edge.to)) {
        errors.push(`L'arête ${index + 1} référence un nœud inconnu : ${edge.to}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = { validateGraph };
