class DantzigService {
  constructor() {
    this.INF = Number.POSITIVE_INFINITY;
  }

  executeDantzig(graph, sourceNode = null, mode = 'min') {
    const nodeIds = Array.isArray(graph.nodes) ? graph.nodes : [];
    const nodes = nodeIds.map((id) => typeof id === 'string' ? { id } : id);
    const n = nodes.length;
    const nodeIndex = {};
    nodes.forEach((node, index) => {
      nodeIndex[node.id] = index;
    });

    const source = sourceNode || nodes[0]?.id;
    if (!source || !nodeIndex.hasOwnProperty(source)) {
      throw new Error('Le nœud source est invalide ou non trouvé');
    }

    const adjacencyList = {};
    nodes.forEach(node => {
      adjacencyList[node.id] = [];
    });

    graph.edges.forEach(edge => {
      adjacencyList[edge.from].push({
        to: edge.to,
        weight: edge.weight
      });
    });

    const steps = [];
    const lambdas = {};
    const markedNodes = [];
    const predecessors = {};

    const initialLambda = mode === 'min' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    nodes.forEach(node => {
      lambdas[node.id] = initialLambda;
      predecessors[node.id] = null;
    });

    lambdas[source] = 0;
    markedNodes.push(source);

    steps.push({
      iteration: 0,
      description: 'Initialisation',
      lambdas: { ...lambdas },
      markedNodes: [...markedNodes],
      currentNode: null,
      selectedEdge: null,
      explanation: `On pose λ_${source} = 0 et E₁ = { ${source} }`
    });

    for (let k = 0; k < n - 1; k++) {
      let bestCandidate = mode === 'min' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      let selectedFrom = null;
      let selectedTo = null;

      markedNodes.forEach(fromNode => {
        adjacencyList[fromNode].forEach(edge => {
          if (!markedNodes.includes(edge.to)) {
            const candidate = lambdas[fromNode] + edge.weight;
            
            if (mode === 'min') {
              if (candidate < bestCandidate) {
                bestCandidate = candidate;
                selectedFrom = fromNode;
                selectedTo = edge.to;
              }
            } else {
              if (candidate > bestCandidate) {
                bestCandidate = candidate;
                selectedFrom = fromNode;
                selectedTo = edge.to;
              }
            }
          }
        });
      });

      if (selectedTo === null) {
        break;
      }

      lambdas[selectedTo] = bestCandidate;
      predecessors[selectedTo] = selectedFrom;
      markedNodes.push(selectedTo);

      steps.push({
        iteration: k + 1,
        description: `Étape ${k + 1}`,
        lambdas: { ...lambdas },
        markedNodes: [...markedNodes],
        currentNode: selectedTo,
        selectedEdge: { from: selectedFrom, to: selectedTo, weight: graph.edges.find(e => e.from === selectedFrom && e.to === selectedTo)?.weight },
        explanation: `${mode === 'min' ? 'min' : 'max'} [ λ_${selectedFrom} + v(${selectedFrom}, ${selectedTo}) ] = ${lambdas[selectedFrom]} + ${graph.edges.find(e => e.from === selectedFrom && e.to === selectedTo)?.weight} = ${bestCandidate} - E_{${k + 2}} = { ${markedNodes.join(', ')} }`
      });
    }

    const optimalPaths = this.reconstructPaths(predecessors, source, nodes);

    return {
      initialLambdas: { ...steps[0].lambdas },
      steps,
      finalLambdas: { ...lambdas },
      markedNodes,
      predecessors,
      optimalPaths,
      sourceNode: source,
      nodes
    };
  }

  reconstructPaths(predecessors, source, nodes) {
    const paths = [];

    nodes.forEach(node => {
      if (node.id !== source) {
        const path = [];
        let current = node.id;

        while (current !== null) {
          path.unshift(current);
          current = predecessors[current];
        }

        if (path[0] === source) {
          paths.push({
            from: source,
            to: node.id,
            path
          });
        }
      }
    });

    return paths;
  }
}

module.exports = new DantzigService();
